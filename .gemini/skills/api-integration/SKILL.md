---
name: api-integration
description: Expert in building and connecting APIs, creating integrations with external services, and developing robust API endpoints. Use when working with REST APIs, webhooks, authentication, or building API-based features for your SaaS.
---

# API Integration & Development Skill

When working with APIs, follow these expert guidelines:

## Initial Analysis

Before starting any API work:

1. **Understand the context**: What's the goal? What data needs to be exchanged?
2. **Check authentication**: API Key, OAuth2, JWT, or Bearer Token?
3. **Review documentation**: Read the full API docs, identify endpoints, rate limits, and error codes
4. **Verify credentials**: Ensure keys are available, valid, and have correct permissions

## Integrating External APIs

### Best practices for API clients

- **Always use a base client class** with session management, error handling, and retries
- **Implement rate limiting** to respect API quotas (use time.sleep or tenacity library)
- **Add exponential backoff** for failed requests
- **Log all requests** with details (endpoint, status, duration)
- **Use environment variables** for credentials - never hardcode keys
- **Set appropriate timeouts** (default: 30s, adjust per endpoint)

### Essential error handling

Handle these status codes explicitly:
- **400**: Bad Request - validate parameters before sending
- **401**: Unauthorized - check credentials and token expiration
- **403**: Forbidden - verify permissions/scopes
- **404**: Not Found - confirm resource exists
- **429**: Rate Limit - implement backoff and retry
- **500**: Server Error - log and retry with exponential backoff

### Code structure for integrations
```python
import requests
from typing import Dict, Any, Optional
import logging
import time

class APIClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self.logger = logging.getLogger(__name__)
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
    
    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        try:
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError:
            self._handle_api_error(response)
        except Exception as e:
            self.logger.error(f"Request failed: {e}")
            raise
    
    def get(self, endpoint: str, params: Optional[Dict] = None):
        url = f"{self.base_url}/{endpoint}"
        response = self.session.get(
            url, 
            headers=self._get_headers(),
            params=params,
            timeout=self.timeout
        )
        return self._handle_response(response)
```

## Creating Your Own APIs

### FastAPI structure for production

- **Use Pydantic models** for request/response validation
- **Implement authentication** (JWT, API keys, OAuth2)
- **Add rate limiting** to protect your API
- **Version your API** from day one (e.g., /api/v1/)
- **Enable CORS** appropriately for your use case
- **Create middleware** for logging, error handling, and monitoring
- **Document automatically** with OpenAPI/Swagger

### Essential endpoints to include
```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel

app = FastAPI(title="Your SaaS API", version="1.0.0")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Example CRUD endpoint
@app.post("/api/v1/items", status_code=201)
async def create_item(item: ItemCreate, token: str = Depends(verify_token)):
    try:
        result = save_item(item)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Webhooks Implementation

### Receiving webhooks securely

- **Verify signatures** using HMAC to confirm authenticity
- **Process asynchronously** using background tasks
- **Return 200 immediately** - don't make the sender wait
- **Implement idempotency** to handle duplicate deliveries
- **Log all webhook events** for debugging
```python
import hmac
import hashlib
from fastapi import BackgroundTasks, Header

@app.post("/webhooks/provider")
async def handle_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_signature: str = Header(...)
):
    body = await request.body()
    
    if not verify_webhook_signature(body, x_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    payload = await request.json()
    background_tasks.add_task(process_webhook, payload)
    
    return {"status": "received"}
```

## Debugging Common API Issues

**Problem: 401 Unauthorized**
→ Check token expiration, header format, and required scopes

**Problem: 429 Rate Limit**
→ Implement exponential backoff, respect Retry-After headers, add caching

**Problem: Timeout**
→ Increase timeout value, use async requests, implement webhooks for long operations

**Problem: Inconsistent data**
→ Validate response schemas, add detailed logging, use API versioning

## Quality Checklist

Before deploying API integrations:
- [ ] Authentication implemented correctly
- [ ] Rate limiting respected with retry logic
- [ ] All errors handled with proper logging
- [ ] Timeouts configured appropriately
- [ ] Credentials stored in environment variables
- [ ] Tests created (unit and integration)
- [ ] Monitoring and alerts configured

Before deploying your APIs:
- [ ] API versioning implemented (/v1/)
- [ ] Auto-documentation enabled (Swagger)
- [ ] Authentication and authorization working
- [ ] Input validation on all endpoints
- [ ] Rate limiting configured
- [ ] CORS configured for your domains
- [ ] Error responses standardized
- [ ] Health check endpoint available
- [ ] Logging and metrics in place

## Critical Best Practices

1. **Always use HTTPS** in production
2. **Never commit credentials** to version control
3. **Validate all user inputs** before processing
4. **Use async/await** for I/O operations
5. **Implement idempotency** for critical operations
6. **Monitor API health** and set up alerts
7. **Cache responses** when appropriate
8. **Use connection pooling** for better performance
9. **Test error scenarios** not just happy paths
10. **Document breaking changes** clearly

## Useful Tools

- **Postman/Insomnia**: Test and debug APIs
- **ngrok**: Expose local server for webhook testing
- **httpie**: Command-line HTTP client
- **Sentry**: Error tracking and monitoring
- **FastAPI/Flask**: Build Python APIs quickly

---

Apply these principles systematically to build reliable, maintainable API integrations and endpoints for your SaaS platform.
