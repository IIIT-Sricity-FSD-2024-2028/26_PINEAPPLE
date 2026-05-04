# TeamForge Backend - Core Infrastructure Setup

This document explains the core infrastructure components configured in the NestJS backend.

---

## 1. Bootstrap Configuration (`main.ts`)

The application bootstrap is organized with clear sections:

### Global Validation Pipe
```typescript
app.useGlobalPipes(getValidationPipeConfig());
```

**Features:**
- Automatically validates all DTOs using `class-validator`
- Whitelists known properties (rejects unknown ones)
- Auto-transforms payloads to DTO class types
- Implicit type conversion (e.g., string `"123"` → number `123`)
- Returns `400 Bad Request` on validation failure

**Example:**
```typescript
// DTO
class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;
}

// Request with validation error
POST /users
{ "email": "invalid-email", "name": "John" }

// Response
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": {
    "field": "email",
    "message": "email must be an email"
  }
}
```

---

### Global Exception Filter
```typescript
app.useGlobalFilters(new HttpExceptionFilter());
```

**Features:**
- Catches all `HttpException` instances
- Formats errors with consistent structure
- Logs exceptions for debugging
- Returns structured error responses with timestamps

**Error Response Format:**
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": {},
  "timestamp": "2026-03-15T10:30:00Z",
  "path": "/api/users"
}
```

---

### Swagger/OpenAPI Setup

**Configuration File:** `src/config/swagger.config.ts`

```typescript
const swaggerConfig = getSwaggerConfig().build();
const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api/docs', app, document);
exportSwaggerToFile(document);
```

**Features:**
- Generates OpenAPI 3.0 specification
- UI available at `http://localhost:3000/api/docs`
- Automatically exports spec to `docs/swagger.json` on startup
- Documents all endpoints, DTOs, and status codes

**Accessing Documentation:**
- **Interactive UI:** Visit `http://localhost:3000/api/docs`
- **Raw JSON:** `docs/swagger.json` in the project root

---

## 2. Role-Based Access Control (RBAC)

### Roles Guard (`src/common/guards/roles.guard.ts`)

The `RolesGuard` enforces RBAC by checking the `x-user-role` header.

**How It Works:**
1. Reads `x-user-role` header from request
2. Checks if header value matches authorized roles
3. Returns `403 Forbidden` if unauthorized
4. Logs all authorization attempts

**Valid Roles:**
- `admin` - Platform administrator
- `mentor` - Approved mentor
- `project-owner` - Project creator/manager
- `collaborator` - Default user role
- `superuser` - Full system access

### Roles Decorator (`src/common/decorators/roles.decorator.ts`)

Specify required roles on controller methods:

```typescript
@UseGuards(RolesGuard)
@Roles('admin', 'mentor')
@Get('/protected')
getProtected() {
  return { data: 'Admin or Mentor only' };
}
```

### Usage Examples

**Example 1: Single Role**
```typescript
@UseGuards(RolesGuard)
@Roles('admin')
@Delete('/users/:id')
deleteUser(@Param('id') id: string) {
  // Only admins can access
}
```

**Example 2: Multiple Roles**
```typescript
@UseGuards(RolesGuard)
@Roles('admin', 'project-owner')
@Post('/projects')
createProject(@Body() dto: CreateProjectDto) {
  // Admins and project-owners can access
}
```

**Example 3: Public Endpoint (No @Roles)**
```typescript
@Get('/leaderboard')
getLeaderboard() {
  // No @Roles decorator = public, no auth required
}
```

### Client Usage

Include the `x-user-role` header in all requests:

```bash
# Using curl
curl -X GET http://localhost:3000/users \
  -H "x-user-role: admin"

# Using fetch
fetch('http://localhost:3000/users', {
  headers: {
    'x-user-role': 'admin',
    'Content-Type': 'application/json'
  }
})

# Using axios
axios.get('http://localhost:3000/users', {
  headers: {
    'x-user-role': 'admin'
  }
})
```

---

## 3. CORS Configuration

CORS is enabled for all origins with allowed headers:

```typescript
app.enableCors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'x-user-role'],
});
```

**Allowed Methods:** GET, POST, PUT, DELETE, PATCH  
**Allowed Headers:** Content-Type, x-user-role  
**Origin:** All origins allowed (`*`)

---

## 4. Validation Configuration

**File:** `src/config/validation.config.ts`

Settings applied globally via `ValidationPipe`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `whitelist` | `true` | Remove non-whitelisted properties |
| `forbidNonWhitelisted` | `true` | Reject non-whitelisted properties |
| `transform` | `true` | Auto-transform to DTO types |
| `enableImplicitConversion` | `true` | Convert types (string → number) |
| `errorHttpStatusCode` | `400` | HTTP status for validation errors |

---

## 5. Swagger Export

The OpenAPI spec is automatically exported to `docs/swagger.json` on startup.

**File:** `src/common/utils/swagger-export.util.ts`

**Usage:**
```typescript
const document = SwaggerModule.createDocument(app, config);
exportSwaggerToFile(document);
```

**Output Example:**
```bash
✅ Swagger spec exported to: /path/to/back-end/docs/swagger.json
```

---

## 6. Application Startup Output

When the server starts successfully:

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  ✅ TeamForge Backend is running                               ║
║  🌐 Server: http://localhost:3000                              ║
║  📚 API Docs: http://localhost:3000/api/docs                   ║
║  🔐 RBAC: Enforced via x-user-role header                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 7. Error Handling Examples

### Missing x-user-role Header

**Request:**
```bash
GET http://localhost:3000/admin/users
```

**Response:**
```json
{
  "statusCode": 403,
  "message": "Missing required x-user-role header. Provide one of: admin",
  "timestamp": "2026-03-15T10:30:00Z",
  "path": "/admin/users"
}
```

### Unauthorized Role

**Request:**
```bash
GET http://localhost:3000/admin/users
x-user-role: collaborator
```

**Response:**
```json
{
  "statusCode": 403,
  "message": "Your role 'collaborator' is not authorized. Required: admin",
  "timestamp": "2026-03-15T10:30:00Z",
  "path": "/admin/users"
}
```

### Validation Error

**Request:**
```bash
POST http://localhost:3000/users
Content-Type: application/json
x-user-role: admin

{ "email": "invalid", "name": "" }
```

**Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": {
    "message": ["email must be an email", "name should not be empty"],
    "error": "Bad Request",
    "statusCode": 400
  },
  "timestamp": "2026-03-15T10:30:00Z",
  "path": "/users"
}
```

---

## 8. File Structure

```
back-end/
├── src/
│   ├── config/
│   │   ├── swagger.config.ts      # Swagger configuration
│   │   └── validation.config.ts   # Validation pipe config
│   ├── common/
│   │   ├── decorators/
│   │   │   └── roles.decorator.ts # @Roles decorator
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   └── roles.guard.ts     # RBAC guard
│   │   ├── utils/
│   │   │   └── swagger-export.util.ts
│   │   └── abstracts/
│   │       └── base.service.ts
│   ├── main.ts                    # Bootstrap entry point
│   └── app.module.ts              # Root module
└── docs/
    └── swagger.json               # Generated OpenAPI spec
```

---

## 9. Best Practices

1. **Always include `x-user-role` header** in client requests
2. **Use `@Roles()` decorator** on protected endpoints
3. **Validate all DTOs** - class-validator handles it automatically
4. **Log important operations** - use Logger from NestJS
5. **Test with Swagger UI** - available at `/api/docs`
6. **Check error responses** - they include timestamps and paths

---

## Next Steps

With core infrastructure ready, the next phases will implement:
1. Feature modules (Users, Projects, Tasks, etc.)
2. Service layer for business logic
3. Repository layer for data persistence
4. Integration tests

