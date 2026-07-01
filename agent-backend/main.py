import json
import os
import re
import traceback
import uuid
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="Bepsi Report Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    input: Any = None
    snapshot: Any = None
    task: str | None = None


def make_prompt(data: Any) -> str:
    text = json.dumps(data or {}, ensure_ascii=False, indent=2)
    if len(text) > 36000:
        text = text[:36000] + "\n/* truncated */"

    return f"""
Dữ liệu thô từ app Bếp Sỉ Báo Cáo/Bépi Field Report:

{text}

Hãy phân tích dữ liệu trên và trả về đúng JSON schema đã được yêu cầu trong instruction.
Không markdown.
Không bịa dữ liệu.
Không tự tạo giá, số điện thoại, địa chỉ, doanh thu nếu dữ liệu không có.
"""


def parse_json_from_text(text: str) -> Dict[str, Any]:
    if not text:
        return {
            "summary": "Agent không trả nội dung.",
            "market_insights": [],
            "product_insights": [],
            "customer_actions": [],
            "sample_requests": [],
            "follow_up_list": [],
            "order_opportunities": [],
            "risks": ["Agent không trả nội dung."],
            "next_steps": ["Kiểm tra log Cloud Run."],
        }

    cleaned = text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except Exception:
            pass

    return {
        "summary": cleaned,
        "market_insights": [],
        "product_insights": [],
        "customer_actions": [],
        "sample_requests": [],
        "follow_up_list": [],
        "order_opportunities": [],
        "risks": [],
        "next_steps": [],
    }


async def run_adk_agent(prompt: str) -> str:
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from agent import root_agent

    app_name = "bepsi_report_agent"
    user_id = "report_app"
    session_id = str(uuid.uuid4())

    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
    )

    runner = Runner(
        agent=root_agent,
        app_name=app_name,
        session_service=session_service,
    )

    content = types.Content(
        role="user",
        parts=[types.Part(text=prompt)],
    )

    final_text = ""

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if hasattr(event, "is_final_response") and event.is_final_response():
            if event.content and event.content.parts:
                final_text = "\n".join(
                    [part.text for part in event.content.parts if getattr(part, "text", None)]
                )

    return final_text


@app.get("/")
async def root():
    return {
        "ok": True,
        "service": "bepsi-report-agent",
        "endpoints": ["/health", "/analyze"],
    }


@app.get("/health")
async def health():
    return {
        "ok": True,
        "project": os.getenv("GOOGLE_CLOUD_PROJECT", ""),
        "location": os.getenv("GOOGLE_CLOUD_LOCATION", ""),
        "vertex": os.getenv("GOOGLE_GENAI_USE_VERTEXAI", ""),
    }


@app.post("/analyze")
async def analyze(payload: AnalyzeRequest):
    data = payload.snapshot if payload.snapshot is not None else payload.input
    prompt = make_prompt(data)

    try:
        text = await run_adk_agent(prompt)
        result = parse_json_from_text(text)
        return {
            "ok": True,
            "source": "google_adk_cloud_run",
            "result": result,
            "raw": text,
        }
    except Exception as exc:
        return {
            "ok": False,
            "source": "google_adk_cloud_run_error",
            "error": str(exc),
            "trace": traceback.format_exc(),
            "result": {
                "summary": f"Agent backend lỗi: {exc}",
                "market_insights": [],
                "product_insights": [],
                "customer_actions": [],
                "sample_requests": [],
                "follow_up_list": [],
                "order_opportunities": [],
                "risks": [str(exc)],
                "next_steps": ["Mở Cloud Run Logs để xem lỗi chi tiết."],
            },
        }
