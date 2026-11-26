# Deployment Guide

## Prerequisites

- Docker Desktop (with Docker Compose v2)
- Node.js 24+ (for local development without Docker)

## Running with Docker Compose

1. Copy the environment template if `.env` does not exist:
   ```bash
   cp .env.example .env
   ```
2. Build and start all three services (`postgres`, `api`, `web`):
   ```bash
   docker compose up --build -d
   ```
3. Check service health:
   ```bash
   docker compose ps
   ```
4. Access the services:
   - Web (Next.js): http://localhost:3000
   - API (NestJS): http://localhost:3001
   - API Health: http://localhost:3001/health
   - PostgreSQL: `localhost:5432`

## Stopping Services

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```
