FROM python:3.11-slim

WORKDIR /app

# System deps commonly needed by CV libraries (kept minimal for the stub).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8080
ENV PORT=8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
