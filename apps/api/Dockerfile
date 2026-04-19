# Build from repository root:
#   docker build -f apps/api/Dockerfile .
#
# Default CMD: FastAPI + Mangum (HTTP API). Override CMD / image_config for the SQS worker
# to: workers.sqs_worker.handler

FROM public.ecr.aws/lambda/python:3.12

WORKDIR /var/task

RUN pip install --no-cache-dir \
    "fastapi>=0.116" "uvicorn[standard]>=0.35" "mangum>=0.19" \
    "pydantic>=2.11" "pydantic-settings>=2.7" "python-dotenv>=1.1" \
    "httpx>=0.28" "fastapi-clerk-auth>=0.0.9" "python-jose[cryptography]>=3.5" \
    "boto3>=1.40" "langfuse>=3.3" "openai-agents[litellm]>=0.3" "pydantic-ai>=1.0" \
    "polygon-api-client>=1.15" "tenacity>=9.1" "supabase>=2.28"

COPY backend/database /opt/alex/database
RUN pip install --no-cache-dir /opt/alex/database

COPY backend/alex_llm /opt/alex/alex_llm
RUN pip install --no-cache-dir /opt/alex/alex_llm

COPY backend/planner /var/task/planner

COPY apps/api /var/task/

CMD ["http_handler.handler"]
