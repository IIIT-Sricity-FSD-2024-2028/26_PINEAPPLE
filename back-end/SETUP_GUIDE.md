# Backend Core Infrastructure - Setup & Installation Guide

## Quick Start

### 1. Install Dependencies

```bash
cd back-end
npm install
```

This installs all required packages:
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`
- `@nestjs/swagger`, `swagger-ui-express`
- `class-validator`, `class-transformer`
- `reflect-metadata`, `rxjs`
- TypeScript and development tools

### 2. Start Development Server

```bash
npm run start:dev
```

**Output:**
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

### 3. Access Swagger Documentation

Open in browser:
```
http://localhost:3000/api/docs
```

Or view the generated JSON:
```
docs/swagger.json
```

---

## Architecture Overview

### Module Organization

```
src/
├── config/                    # Configuration modules
│   ├── swagger.config.ts      # OpenAPI spec builder
│   └── validation.config.ts   # Validation pipe config
│
├── common/                    # Shared infrastructure
│   ├── decorators/
│   │   └── roles.decorator.ts # @Roles for RBAC
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   └── roles.guard.ts     # x-user-role header validator
│   ├── abstracts/
│   │   └── base.service.ts    # Generic CRUD service
│   └── utils/
│       └── swagger-export.util.ts
│
├── users/                     # Users feature module
│
├── app.module.ts              # Root module
├── app.controller.ts          # Root controller (health check)
├── app.service.ts             # Root service
└── main.ts                    # Bootstrap entry point

docs/
└── swagger.json               # Auto-generated OpenAPI spec
```

---

## Core Components Explained

### 1. Validation Pipeline

**File:** `src/config/validation.config.ts`

Automatically validates all request payloads:

```typescript
POST /users
{
  "email": "not-an-email",
  "name": ""
}

// Response (400 Bad Request)
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": {
    "message": [
      "email must be an email",
      "name should not be empty"
    ]
  }
}
```

**Features:**
- ✅ Whitelist mode (rejects unknown properties)
- ✅ Auto-transform to DTO types
- ✅ Type coercion (string "123" → number 123)
- ✅ All configured globally in `main.ts`

---

### 2. RBAC (Role-Based Access Control)

**Files:**
- `src/common/guards/roles.guard.ts` - Validates `x-user-role` header
- `src/common/decorators/roles.decorator.ts` - Marks endpoints with required roles

**How It Works:**

```typescript
// Endpoint definition
@UseGuards(RolesGuard)
@Roles('admin', 'mentor')
@Get('/protected')
getProtected() { ... }

// Client request
GET /protected
x-user-role: admin

// ✅ Authorized (admin is in allowed roles)

// Client request
GET /protected
x-user-role: collaborator

// ❌ Forbidden (collaborator not in allowed roles)
```

**Valid Roles:**
- `admin`
- `mentor`
- `project-owner`
- `collaborator`
- `superuser`

**Required Header:**
```
x-user-role: <role-name>
```

---

### 3. Swagger/OpenAPI Documentation

**Files:**
- `src/config/swagger.config.ts` - Builds OpenAPI spec
- `src/common/utils/swagger-export.util.ts` - Exports to JSON file

**Auto-Generated Files:**
- Interactive UI: `http://localhost:3000/api/docs`
- JSON spec: `docs/swagger.json`

**Features:**
- ✅ Auto-documents all endpoints
- ✅ Shows DTOs and their validation rules
- ✅ Displays error responses
- ✅ Interactive testing interface
- ✅ JSON export for external tools

---

### 4. Exception Handling

**File:** `src/common/filters/http-exception.filter.ts`

All errors formatted consistently:

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

## Testing the Setup

### Test 1: Health Check (No Auth)

```bash
curl http://localhost:3000
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "TeamForge backend is running."
}
```

### Test 2: Missing x-user-role Header

```bash
curl http://localhost:3000/users
```

**Expected Response (403):**
```json
{
  "statusCode": 403,
  "message": "Missing required x-user-role header. Provide one of: admin, user"
}
```

### Test 3: Unauthorized Role

```bash
curl http://localhost:3000/users \
  -H "x-user-role: collaborator"
```

**Expected Response (403):**
```json
{
  "statusCode": 403,
  "message": "Your role 'collaborator' is not authorized. Required: admin, user"
}
```

### Test 4: Valid Request

```bash
curl http://localhost:3000/users \
  -H "x-user-role: admin"
```

**Expected Response (200):**
```json
[]
```

---

## Development Workflow

### Adding a New Endpoint with RBAC

1. **Create the Controller Method:**
```typescript
@UseGuards(RolesGuard)
@Roles('admin', 'project-owner')
@Post('/projects')
@ApiOperation({ summary: 'Create a project' })
@ApiCreatedResponse({ description: 'Project created' })
async createProject(
  @Body() createProjectDto: CreateProjectDto,
): Promise<Project> {
  return this.projectsService.create(createProjectDto);
}
```

2. **Client Request:**
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "name": "My Project",
    "desc": "Description here"
  }'
```

3. **Swagger UI:**
- Automatically documents the endpoint
- Shows required `x-user-role` header
- Displays DTO validation rules
- Allows interactive testing

---

## Logging

Debug logs are printed during request processing:

```
[NestFactory] Starting Nest application...
[InstanceLoader] AppModule dependencies initialized +15ms
[RoutesResolver] AppController {/}: +1ms
[RouterExplorer] Mapped {/,GET} route +1ms
[NestApplication] Nest application successfully started +2ms
✅ Swagger spec exported to: .../docs/swagger.json
```

Enable debug logging:
```bash
DEBUG=* npm run start:dev
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/main.ts` | Application bootstrap with pipes, filters, Swagger |
| `src/config/swagger.config.ts` | OpenAPI spec builder |
| `src/config/validation.config.ts` | Validation pipe configuration |
| `src/common/guards/roles.guard.ts` | RBAC guard (x-user-role header) |
| `src/common/decorators/roles.decorator.ts` | @Roles decorator |
| `src/common/filters/http-exception.filter.ts` | Global error handler |
| `src/common/utils/swagger-export.util.ts` | Export OpenAPI to JSON |
| `src/app.module.ts` | Root module (imports all features) |
| `docs/swagger.json` | Generated OpenAPI spec (auto-created) |

---

## Troubleshooting

### Error: "Cannot find module '@nestjs/common'"
**Solution:** Run `npm install` in the `back-end` directory

### Error: "Port 3000 already in use"
**Solution:** Kill the process or use different port:
```bash
PORT=3001 npm run start:dev
```

### Swagger UI not updating after code changes
**Solution:** The UI caches dynamically. Hard refresh (Ctrl+Shift+R) or:
```bash
# Restart the server
npm run start:dev
```

---

## Next Steps

This infrastructure is ready for:
1. **Users Module** - User CRUD, profiles, authentication
2. **Projects Module** - Project management
3. **Tasks Module** - Task assignment and approval
4. **Additional Modules** - Notifications, Leaderboard, etc.

Each module will:
- ✅ Use the global RolesGuard for RBAC
- ✅ Leverage the ValidationPipe for DTOs
- ✅ Auto-appear in Swagger documentation
- ✅ Follow consistent error handling

