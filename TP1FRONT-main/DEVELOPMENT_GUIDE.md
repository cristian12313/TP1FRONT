# JPS Logistic — Sistema Predictivo de Flete Marítimo

## Guía de Desarrollo para Claude Code

**Código:** P20261041
**Versión:** 1.0 — Junio 2026

---

## 1. Contexto del Proyecto

### 1.1 ¿Qué es?

Plataforma web con motor de Machine Learning que predice el costo del flete marítimo (en USD) para importaciones de neumáticos automotrices en la ruta China → Puerto del Callao (Perú). El 100% de los registros del dataset tienen origen China; los puertos de Corea, Japón, Hong Kong o Tailandia que aparecen en el catálogo son puertos de **transbordo**, no de origen. El cliente es **JPS Logistic S.A.C.**, una PYME logística peruana.

### 1.2 Problema que resuelve

Los operadores de JPS Logistic estiman fletes manualmente con hojas de cálculo, generando errores superiores al 25%. El sistema automatiza ese proceso usando XGBoost entrenado con datos históricos de SUNAT y variables de mercado (SCFI, bunker fuel, tipo de cambio SOL/USD, recargos navieros PSS/GRI/EBS).

### 1.3 Equipo

| Rol | Persona |
|---|---|
| Project Manager / Jefe de Desarrollo | Sergio Leandro Guzmán Alva (U202212840) |
| Scrum Master / Jefe de Proyecto | Cristhian Fernando Pacherrez Alfaro (U201922375) |
| Product Owner / Asesor | Ernesto Adolfo Carrera Salas |

### 1.4 Metodología

Scrum + CRISP-DM integrados. Sprints de 3 semanas. 9 sprints totales (8 de desarrollo + 1 de cierre).

---

## 2. Stack Tecnológico

### 2.1 Backend

- **Lenguaje:** Python 3.11+
- **Framework:** FastAPI
- **ORM / DB:** SQLAlchemy + PostgreSQL
- **Auth:** JWT (access + refresh tokens), bcrypt para hashing de contraseñas
- **Validación:** Pydantic v2
- **ML:** XGBoost, scikit-learn, SHAP
- **Experiment Tracking:** MLflow
- **PDF Generation:** reportlab o weasyprint (para cotizaciones con logo JPS)
- **Email:** SMTP (recuperación de contraseña, notificaciones de bloqueo)
- **Testing:** pytest (cobertura objetivo ≥ 70%)

### 2.2 Frontend

- **Framework:** React 18+ (con Vite)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Gráficos:** Recharts (barras agrupadas, pie chart, KPIs)
- **Tablas:** TanStack Table (paginación, sorting, filtros)
- **HTTP Client:** Axios
- **Form Validation:** React Hook Form + Zod
- **PDF Export:** jsPDF o llamada al endpoint backend
- **Notificaciones:** Toast (react-hot-toast o sonner)
- **Routing:** React Router v6
- **State:** Zustand o Context API (ligero, no se necesita Redux)

### 2.3 Infraestructura

- **Containerización:** Docker + docker-compose
- **Deploy Backend:** Railway (Starter Plan)
- **Deploy Frontend:** Render (Static Site)
- **Base de Datos:** PostgreSQL en Railway o Render
- **Entrenamiento ML:** Google Colab Pro (GPU)
- **Versionado de Modelos:** MLflow (local o en Railway)

> **NOTA IMPORTANTE:** La documentación académica menciona "AWS" en los diagramas de arquitectura, pero el despliegue real usa Railway + Render. No usar AWS. En el código y README, referirse a "Cloud Provider" genéricamente y documentar Railway/Render como la implementación concreta.

### 2.4 Herramientas de Desarrollo

- Git + GitHub
- Docker Desktop
- Postman o Swagger UI (FastAPI genera docs automáticamente en `/docs`)

---

## 3. Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────┐
│                      INTERNET (HTTPS:443)                  │
│                                                            │
│  ┌──────────────┐          ┌──────────────────────────┐    │
│  │   Frontend    │  HTTPS   │       Backend             │    │
│  │   React/Vite  │────────→│   FastAPI (Python)        │    │
│  │   (Render)    │          │   (Railway)               │    │
│  └──────────────┘          │                            │    │
│                             │  ┌──────────────────────┐ │    │
│                             │  │  XGBoost Model       │ │    │
│                             │  │  + SHAP explainer    │ │    │
│                             │  └──────────────────────┘ │    │
│                             │                            │    │
│                             │  ┌──────────────────────┐ │    │
│                             │  │  MLflow Tracking     │ │    │
│                             │  └──────────────────────┘ │    │
│                             └────────────┬───────────────┘    │
│                                          │ TCP:5432           │
│                             ┌────────────▼───────────────┐    │
│                             │    PostgreSQL               │    │
│                             │    (Railway)                │    │
│                             └────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### 3.1 Capas

1. **Presentación:** React SPA servida estáticamente (Render). Consume la API REST via HTTPS.
2. **API / Negocio:** FastAPI expone endpoints REST documentados. Puerto interno 8000. Maneja auth, predicciones, CRUD de cotizaciones, dashboard analytics.
3. **ML Engine:** Modelo XGBoost serializado (pickle/joblib). SHAP calcula explicabilidad en cada predicción. MLflow registra experimentos y métricas.
4. **Datos:** PostgreSQL almacena usuarios, cotizaciones, historial, logs de auditoría.

---

## 4. Modelo de Datos (PostgreSQL)

### 4.1 Tablas principales

```sql
-- =============================================
-- USUARIOS Y AUTENTICACIÓN
-- =============================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operativo', 'analista')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    failed_attempts INT DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    token       VARCHAR(255) UNIQUE NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,  -- 30 min desde creación
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CATÁLOGOS
-- =============================================

CREATE TABLE ports (
    id      SERIAL PRIMARY KEY,
    code    VARCHAR(10) UNIQUE NOT NULL,
    name    VARCHAR(150) NOT NULL,
    country VARCHAR(100),
    region  VARCHAR(50)  -- 'china' (origen) | 'callao' (destino). El alcance
                         -- real del modelo es China -> Callao; ver
                         -- DOCUMENTACION_TECNICA.md seccion 4.1.
);

CREATE TABLE container_types (
    id    SERIAL PRIMARY KEY,
    code  VARCHAR(20) UNIQUE NOT NULL,  -- 'FCL20', 'FCL40', 'LCL'
    label VARCHAR(50) NOT NULL           -- "FCL 20'", "FCL 40'", "LCL"
);

-- =============================================
-- COTIZACIONES
-- =============================================

CREATE TABLE quotations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users(id) NOT NULL,
    port_origin_id      INT REFERENCES ports(id) NOT NULL,
    port_destination_id INT REFERENCES ports(id) NOT NULL,
    container_type_id   INT REFERENCES container_types(id) NOT NULL,
    weight_kg           DECIMAL(12,2) NOT NULL,
    volume_cbm          DECIMAL(12,4) NOT NULL,
    shipment_date       DATE NOT NULL,
    estimated_cost_usd  DECIMAL(12,2) NOT NULL,
    confidence_low_usd  DECIMAL(12,2),
    confidence_high_usd DECIMAL(12,2),
    shap_top3           JSONB,           -- [{variable, impact, direction}]
    notes               VARCHAR(500),
    actual_cost_usd     DECIMAL(12,2),   -- registrado por el Analista
    mape_individual     DECIMAL(8,4),    -- calculado al registrar costo real
    status              VARCHAR(30) DEFAULT 'pendiente'
                        CHECK (status IN ('pendiente', 'cerrada_con_costo_real')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- AUDITORÍA
-- =============================================

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity      VARCHAR(50),
    entity_id   VARCHAR(100),
    details     JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CARGA DE DATOS HISTÓRICOS
-- =============================================

CREATE TABLE data_uploads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by     UUID REFERENCES users(id),
    filename        VARCHAR(255) NOT NULL,
    row_count       INT,
    status          VARCHAR(20) DEFAULT 'processing',
    errors          JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de última actualización (para HU-32)
CREATE TABLE system_metadata (
    key         VARCHAR(50) PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: INSERT INTO system_metadata (key, value) VALUES ('last_data_update', NOW()::text);
```

### 4.2 Índices recomendados

```sql
CREATE INDEX idx_quotations_user_id ON quotations(user_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_created_at ON quotations(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
```

---

## 5. API REST — Endpoints

### 5.1 Autenticación (EP-01: HU-01 a HU-09)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/api/auth/login` | Login con email + password. Retorna access_token + refresh_token. Registra intento fallido. Bloquea cuenta tras 5 intentos (15 min). | Público |
| POST | `/api/auth/logout` | Invalida token actual. | Todos |
| POST | `/api/auth/forgot-password` | Envía link de recuperación (30 min). Respuesta genérica siempre. | Público |
| POST | `/api/auth/reset-password` | Recibe token + nueva contraseña. Valida: ≥8 chars, 1 mayúscula, 1 número. | Público |
| POST | `/api/auth/refresh` | Renueva access_token con refresh_token. | Todos |

### 5.2 Gestión de Usuarios (EP-01: HU-06 a HU-09)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/api/users` | Lista usuarios (paginado). | Admin |
| POST | `/api/users` | Crear usuario (nombre, email, rol). Genera contraseña temporal, la envía por email. | Admin |
| PUT | `/api/users/{id}` | Editar nombre, email del usuario. | Admin |
| PATCH | `/api/users/{id}/role` | Cambiar rol (admin, operativo, analista). | Admin |
| PATCH | `/api/users/{id}/disable` | Deshabilitar cuenta (status → inactive). Conserva historial. | Admin |

### 5.3 Predicción de Flete (EP-02: HU-10 a HU-19)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/api/catalogs/ports` | Lista puertos del catálogo. | Operativo, Analista, Admin |
| GET | `/api/catalogs/container-types` | Lista tipos de contenedor. | Operativo, Analista, Admin |
| POST | `/api/predictions/estimate` | Envía variables del embarque → retorna costo estimado (USD), intervalo de confianza, top 3 SHAP variables. Timeout: 10s. | Operativo, Analista |
| POST | `/api/quotations` | Guardar cotización (datos + estimación + nota opcional). | Operativo, Analista |
| GET | `/api/quotations/{id}/pdf` | Genera y descarga PDF de cotización con logo JPS. | Operativo, Analista |

### 5.4 Historial y Gestión (EP-03: HU-20 a HU-26)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/api/quotations` | Historial personal (operativo) o consolidado (analista/admin). Paginado (10/25/50). Filtros: rango de fechas, estado, búsqueda por ID. Sort por cualquier columna. | Operativo, Analista, Admin |
| PATCH | `/api/quotations/{id}/actual-cost` | Registrar costo real → calcula MAPE individual → cambia estado a "cerrada_con_costo_real". | Analista |
| GET | `/api/quotations/export` | Exportar historial a Excel (.xlsx) o CSV (.csv). Respeta filtros activos. Param: `?format=xlsx` o `?format=csv`. | Analista |

### 5.5 Dashboard Estratégico (EP-04: HU-27 a HU-30)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| GET | `/api/dashboard/estimated-vs-actual` | Datos para gráfico de barras: flete estimado promedio vs real promedio, últimos 6 meses. | Analista |
| GET | `/api/dashboard/mape-global` | MAPE global acumulado (todas las cotizaciones cerradas). | Analista |
| GET | `/api/dashboard/ports-distribution` | Distribución de contenedores por puerto de embarque (para pie chart). | Analista |

### 5.6 Administración (EP-05: HU-31 a HU-33)

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/api/admin/upload-csv` | Cargar CSV de data histórica. Valida estructura → preview 10 rows → confirmar. | Admin |
| POST | `/api/admin/upload-csv/confirm` | Confirma la carga tras preview. | Admin |
| GET | `/api/admin/last-update` | Retorna última fecha de actualización de la BD. | Admin |
| GET | `/api/help/faq` | Retorna contenido de FAQ organizado por categorías. | Todos |

---

## 6. Roles y Permisos (RBAC)

| Funcionalidad | Admin | Operativo | Analista |
|---|---|---|---|
| Login / Logout / Recuperar contraseña | ✅ | ✅ | ✅ |
| Gestión de usuarios (CRUD) | ✅ | ❌ | ❌ |
| Nueva cotización (formulario + predicción) | ✅ | ✅ | ✅ |
| Guardar cotización | ✅ | ✅ | ✅ |
| Exportar PDF de cotización | ✅ | ✅ | ✅ |
| Historial personal | ✅ | ✅ | ✅ |
| Historial consolidado (todos los operadores) | ✅ | ❌ | ✅ |
| Registrar costo real | ❌ | ❌ | ✅ |
| Dashboard estratégico (KPIs, gráficos) | ❌ | ❌ | ✅ |
| Exportar historial Excel/CSV | ❌ | ❌ | ✅ |
| Carga de CSV histórico | ✅ | ❌ | ❌ |
| Panel de administración | ✅ | ❌ | ❌ |
| Ayuda / FAQ | ✅ | ✅ | ✅ |

---

## 7. Modelo de ML — Especificación

### 7.1 Algoritmo Principal

**XGBoost Regressor** entrenado con datos históricos de importaciones (SUNAT/aduanas).

### 7.2 Variables de Entrada (Features)

Del formulario del usuario:

- `port_origin` — Puerto de **embarque** (categórica: Shanghai, Ningbo, Qingdao, Busan, etc.).
  El origen siempre es China; Busan, Yokohama o Hong Kong son puertos de transbordo.
  Esa distinción es la que codifica la feature `ruta_directa`.
- `port_destination` — Siempre Callao (fijo, pero puede variar en futuras versiones)
- `container_type` — FCL 20', FCL 40', LCL
- `weight_kg` — Peso bruto en kilogramos
- `volume_cbm` — Volumen en metros cúbicos
- `shipment_date` — Fecha de embarque (de aquí se extraen features temporales)

Variables externas (enriquecimiento, obtenidas de APIs/bases externas):

- `scfi_index` — Shanghai Containerized Freight Index (semanal)
- `bunker_fuel_price` — Precio VLSFO/IFO 380 (USD/ton)
- `sol_usd_rate` — Tipo de cambio SOL/USD (BCRP)
- `pss_surcharge` — Peak Season Surcharge activo (binaria o monto)
- `gri_surcharge` — General Rate Increase activo
- `ebs_surcharge` — Emergency Bunker Surcharge activo

Features derivadas (ingeniería de características):

- `month`, `quarter`, `day_of_week` — extraídas de shipment_date
- `weight_volume_ratio` — weight_kg / volume_cbm
- `is_peak_season` — flag basada en meses de alta demanda
- `scfi_rolling_avg_4w` — promedio móvil 4 semanas del SCFI

### 7.3 Variable Objetivo

- `freight_cost_usd` — Costo real del flete marítimo en USD

### 7.4 Métricas de Evaluación (Objetivos)

| Métrica | Objetivo | Descripción |
|---|---|---|
| **MAPE** | ≤ 15% | Error porcentual absoluto medio |
| **R²** | ≥ 0.80 | Coeficiente de determinación |
| **RMSE** | Reportar | Raíz del error cuadrático medio |
| **MAE** | Reportar | Error absoluto medio |
| **Latencia P95** | ≤ 2.00s | Tiempo de respuesta API en percentil 95 |

### 7.5 Explicabilidad (SHAP)

Cada predicción retorna las **3 variables más influyentes** con:

- Nombre en lenguaje de negocio (no técnico). Ej: "Temporada alta" en vez de `is_peak_season`.
- Dirección del efecto: positivo (encarece) o negativo (abarata).
- Magnitud relativa del impacto (porcentaje).

Mapeo de nombres técnicos a negocio:

```python
SHAP_LABEL_MAP = {
    "container_type_FCL40": "Tipo de contenedor (FCL 40')",
    "container_type_FCL20": "Tipo de contenedor (FCL 20')",
    "weight_kg": "Peso bruto de la carga",
    "volume_cbm": "Volumen de la carga",
    "scfi_index": "Índice de fletes Shanghai (SCFI)",
    "bunker_fuel_price": "Precio del combustible marino",
    "sol_usd_rate": "Tipo de cambio SOL/USD",
    "pss_surcharge": "Recargo por temporada alta (PSS)",
    "gri_surcharge": "Incremento general de tarifa (GRI)",
    "ebs_surcharge": "Recargo de emergencia por combustible (EBS)",
    "is_peak_season": "Temporada de alta demanda",
    "month": "Mes del embarque",
    "port_origin_Shanghai": "Puerto de embarque: Shanghái",
    "port_origin_Ningbo": "Puerto de embarque: Ningbo",
    "weight_volume_ratio": "Relación peso/volumen",
}
```

### 7.6 Intervalo de Confianza

Implementar con quantile regression de XGBoost o bootstrap de predicciones para generar un rango [low, high] al 95% de confianza.

### 7.7 Baseline Comparativo

Entrenar también un modelo de **Regresión Lineal** como baseline para demostrar la mejora de XGBoost en la tesis. Opcionalmente un LSTM simple.

### 7.8 Dataset

- Fuente: SUNAT / registros aduaneros de JPS Logistic
- Archivo actual: `excellimpio.csv` — 500 filas, 31 columnas
- Encoding: verificar Latin-1 vs UTF-8 (corregir a UTF-8)
- Formatos de fecha: normalizar a ISO 8601
- **Limitación conocida:** 500 filas puede ser insuficiente para capturar 12 meses de estacionalidad. Considerar aumentación con datos externos.

---

## 8. Estructura del Proyecto (Monorepo)

```
jps-freight-predictor/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/                    # Migraciones de BD
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Settings (Pydantic BaseSettings)
│   │   ├── database.py             # SQLAlchemy engine/session
│   │   │
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── quotation.py
│   │   │   ├── port.py
│   │   │   ├── container_type.py
│   │   │   ├── audit_log.py
│   │   │   └── data_upload.py
│   │   │
│   │   ├── schemas/                # Pydantic schemas (request/response)
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── quotation.py
│   │   │   ├── prediction.py
│   │   │   └── dashboard.py
│   │   │
│   │   ├── routers/                # API route handlers
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── predictions.py
│   │   │   ├── quotations.py
│   │   │   ├── dashboard.py
│   │   │   ├── admin.py
│   │   │   └── help.py
│   │   │
│   │   ├── services/               # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── user_service.py
│   │   │   ├── prediction_service.py
│   │   │   ├── quotation_service.py
│   │   │   ├── dashboard_service.py
│   │   │   ├── pdf_service.py
│   │   │   ├── csv_upload_service.py
│   │   │   └── email_service.py
│   │   │
│   │   ├── ml/                     # ML model loading & inference
│   │   │   ├── model_loader.py     # Carga modelo XGBoost serializado
│   │   │   ├── predictor.py        # Ejecuta predicción + SHAP
│   │   │   ├── feature_engineering.py
│   │   │   └── shap_explainer.py
│   │   │
│   │   ├── core/                   # Cross-cutting concerns
│   │   │   ├── security.py         # JWT, bcrypt, RBAC middleware
│   │   │   ├── dependencies.py     # FastAPI Depends (get_db, get_current_user)
│   │   │   └── exceptions.py
│   │   │
│   │   └── utils/
│   │       └── audit.py            # Helper para escribir audit_log
│   │
│   ├── ml_artifacts/               # Modelo serializado (.joblib)
│   │   └── xgboost_model_v1.joblib
│   │
│   └── tests/
│       ├── test_auth.py
│       ├── test_predictions.py
│       ├── test_quotations.py
│       └── test_dashboard.py
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   │
│   ├── public/
│   │   └── jps-logo.png            # Logo de JPS Logistic
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                    # Axios instance + API calls
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   ├── quotations.ts
│       │   ├── predictions.ts
│       │   ├── users.ts
│       │   └── dashboard.ts
│       │
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx
│       │   │   └── ProtectedRoute.tsx
│       │   ├── auth/
│       │   │   ├── LoginForm.tsx
│       │   │   ├── ForgotPasswordForm.tsx
│       │   │   └── ResetPasswordForm.tsx
│       │   ├── quotation/
│       │   │   ├── NewQuotationForm.tsx
│       │   │   ├── EstimationResult.tsx
│       │   │   ├── ShapExplanation.tsx
│       │   │   └── SaveQuotationModal.tsx
│       │   ├── history/
│       │   │   ├── QuotationTable.tsx
│       │   │   ├── DateRangeFilter.tsx
│       │   │   ├── StatusBadge.tsx
│       │   │   └── ActualCostModal.tsx
│       │   ├── dashboard/
│       │   │   ├── EstimatedVsActualChart.tsx
│       │   │   ├── MapeKpiCard.tsx
│       │   │   └── PortDistributionPie.tsx
│       │   ├── admin/
│       │   │   ├── UserManagement.tsx
│       │   │   ├── CsvUploader.tsx
│       │   │   └── LastUpdateBadge.tsx
│       │   └── shared/
│       │       ├── LoadingSpinner.tsx
│       │       ├── ErrorAlert.tsx
│       │       └── Toast.tsx
│       │
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx     # Landing post-login
│       │   ├── NewQuotationPage.tsx
│       │   ├── HistoryPage.tsx
│       │   ├── AnalyticsPage.tsx     # Dashboard estratégico (Analista)
│       │   ├── AdminPage.tsx
│       │   └── HelpPage.tsx
│       │
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   └── useQuotations.ts
│       │
│       ├── store/                   # Zustand stores
│       │   └── authStore.ts
│       │
│       ├── types/
│       │   └── index.ts             # TypeScript interfaces
│       │
│       └── utils/
│           ├── formatCurrency.ts
│           └── constants.ts
│
└── notebooks/                       # Jupyter / Colab notebooks
    ├── 01_data_exploration.ipynb
    ├── 02_feature_engineering.ipynb
    ├── 03_model_training.ipynb
    ├── 04_shap_analysis.ipynb
    └── 05_model_export.ipynb
```

---

## 9. Historias de Usuario — Resumen por Épica y Sprint

### EP-01: Seguridad y Accesos (Sprint 1–2)

| ID | Funcionalidad | Prioridad | Sprint |
|---|---|---|---|
| HU-01 | Login con email + contraseña | Alta | 1 |
| HU-02 | Recuperar contraseña por email | Alta | 1 |
| HU-03 | Restablecer contraseña con enlace temporal (30 min) | Alta | 1 |
| HU-04 | Cerrar sesión manual + cierre por inactividad (30 min) | Media | 1 |
| HU-05 | Bloqueo temporal tras 5 intentos fallidos (15 min) | Media | 2 |
| HU-06 | Admin: crear cuentas (genera contraseña temporal) | Alta | 2 |
| HU-07 | Admin: editar nombre/email de usuarios | Media | 2 |
| HU-08 | Admin: deshabilitar cuentas (conserva historial) | Media | 2 |
| HU-09 | Admin: asignar rol (Admin, Operativo, Analista) | Alta | 2 |

### EP-02: Estimación Predictiva de Fletes (Sprint 3–4)

| ID | Funcionalidad | Prioridad | Sprint |
|---|---|---|---|
| HU-10 | Formulario de embarque (puerto, contenedor, peso, volumen, fecha) | Alta | 3 |
| HU-11 | Validación visual en tiempo real (campos obligatorios en rojo) | Media | 3 |
| HU-12 | Spinner "Calculando estimación…" + timeout 10s | Baja | 3 |
| HU-13 | Mostrar costo estimado en USD (2 decimales) + intervalo confianza | Alta | 3 |
| HU-14 | Alerta amigable si el servicio falla (5xx) o sin internet | Media | 3 |
| HU-15 | Top 3 variables SHAP en lenguaje de negocio | Alta | 4 |
| HU-16 | Exportar PDF con logo JPS (Cotizacion_JPS_[ID]_[FECHA].pdf) | Alta | 4 |
| HU-17 | Guardar cotización en BD (ID único, fecha, usuario, datos) | Alta | 4 |
| HU-18 | Nota/comentario opcional al guardar (máx 500 chars) | Baja | 4 |
| HU-19 | Toast de confirmación "Cotización guardada con ID: [XXX]" | Media | 4 |

### EP-03: Historial y Gestión de Cotizaciones (Sprint 5–6)

| ID | Funcionalidad | Prioridad | Sprint |
|---|---|---|---|
| HU-20 | Tabla con historial (ID, Fecha, Puerto, Contenedor, Costo, Estado) | Alta | 5 |
| HU-21 | Paginación: 10 por defecto, selector 10/25/50 | Media | 5 |
| HU-22 | Filtro por rango de fechas + botón "Limpiar filtros" | Media | 5 |
| HU-23 | Historial consolidado (todos los operadores) — solo Analista | Alta | 5 |
| HU-24 | Búsqueda por ID exacto de cotización | Media | 6 |
| HU-25 | Registrar costo real → calcula MAPE individual → estado "Cerrada" | Alta | 6 |
| HU-26 | Badge de estado: amarillo = Pendiente, verde = Cerrada | Media | 6 |

### EP-04: Análisis Estratégico y KPIs (Sprint 7)

| ID | Funcionalidad | Prioridad | Sprint |
|---|---|---|---|
| HU-27 | Gráfico barras: Estimado vs Real promedio mensual (6 meses) | Alta | 7 |
| HU-28 | KPI card: MAPE global (verde ≤15%, rojo >15%) | Alta | 7 |
| HU-29 | Pie chart: distribución por puerto de embarque | Media | 7 |
| HU-30 | Exportar historial a Excel o CSV | Media | 7 |

### EP-05: Mantenimiento y Soporte (Sprint 8)

| ID | Funcionalidad | Prioridad | Sprint |
|---|---|---|---|
| HU-31 | Interfaz carga CSV: validar estructura + preview 10 rows + confirmar | Alta | 8 |
| HU-32 | Mostrar "Última actualización: DD/MM/AAAA HH:MM" en panel admin | Media | 8 |
| HU-33 | Pantalla Ayuda/FAQ por categorías | Baja | 8 |

---

## 10. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| **RNF-01** | Latencia de predicción P95 ≤ 2.00 segundos |
| **RNF-02** | MAPE del modelo ≤ 15% (vs. >25% del método manual) |
| **RNF-03** | Disponibilidad ≥ 95% en horario laboral |
| **RNF-04** | Seguridad: JWT, bcrypt, RBAC, anonimización de datos, HTTPS |
| **RNF-05** | Interfaz intuitiva para usuarios sin formación técnica en ML |
| **RNF-06** | Arquitectura modular y escalable. Reentrenamiento sin downtime |
| **RNF-07** | Portabilidad: Docker. Sin dependencia de proveedor de nube específico |
| **RNF-08** | Código mantenible con buenas prácticas (linting, typing, docstrings) |
| **RNF-09** | Anonimización de datos sensibles de la empresa y clientes |
| **RNF-10** | API REST documentada (Swagger/OpenAPI automático de FastAPI) |

---

## 11. Seguridad — Controles ISO 27001

| Control | Implementación |
|---|---|
| Autenticación | JWT (access token 30min + refresh token 7d) |
| Hashing | bcrypt con salt |
| RBAC | Middleware que verifica rol en cada endpoint |
| Validación de entrada | Pydantic v2 en todos los endpoints |
| Transporte | HTTPS obligatorio (Railway/Render proveen TLS) |
| Bloqueo de cuenta | 5 intentos fallidos → bloqueo 15 min + notificación email |
| Timeout de sesión | 30 min de inactividad → cierre automático (frontend) |
| Anonimización | Datos del dataset histórico anonimizados antes de carga |
| Auditoría | Tabla `audit_log` registra cada acción CRUD con timestamp, user, IP |
| MLflow | Trail de auditoría de experimentos del modelo |

### Normativa legal aplicable

- Ley N.° 29733 — Protección de Datos Personales (Perú)
- D.S. N.° 016-2024-JUS — Reglamento de la Ley 29733
- Ley N.° 30096 — Delitos Informáticos
- D. Leg. N.° 822 — Derecho de Autor (dataset)

---

## 12. Catálogos Semilla (Seed Data)

### Puertos de embarque (China y puertos de transbordo)

```
Shanghai, Ningbo, Qingdao, Busan, Kaohsiung, Laem Chabang, Ho Chi Minh, Tanjung Pelepas, Colombo, Yokohama
```

### Puerto de destino

```
Callao (Perú)
```

### Tipos de contenedor

```
FCL 20' — Contenedor completo 20 pies
FCL 40' — Contenedor completo 40 pies
LCL    — Carga consolidada (Less than Container Load)
```

---

## 13. Casos de Prueba — Resumen

El proyecto tiene **68 casos de prueba** (CP001 a CP068), mapeados 1:1 a los escenarios de las historias de usuario. Ejecución manual. Algunos críticos:

| CP | Descripción | HU | Prioridad |
|---|---|---|---|
| CP001 | Login exitoso → redirige a dashboard + registra acceso | HU-01 | Alta |
| CP002 | Credenciales incorrectas → mensaje genérico | HU-01 | Alta |
| CP011 | 5 intentos fallidos → bloqueo 15 min + email | HU-05 | Alta |
| CP021 | Formulario de cotización tiene todos los campos | HU-10 | Alta |
| CP027 | Costo estimado en USD con 2 decimales | HU-13 | Alta |
| CP031 | Top 3 SHAP con dirección positiva/negativa | HU-15 | Alta |
| CP033 | PDF con logo, datos embarque, resultado | HU-16 | Alta |
| CP047 | Historial consolidado visible solo para Analista | HU-23 | Alta |
| CP052 | MAPE individual se calcula al registrar costo real | HU-25 | Alta |
| CP057 | KPI card MAPE global con color condicionado | HU-28 | Alta |

---

## 14. Configuración del Entorno

### 14.1 Variables de entorno (.env)

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/jps_freight

# JWT
JWT_SECRET_KEY=<random-256-bit-key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# SMTP (para recuperación de contraseña)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@jpslogistic.com
SMTP_PASSWORD=<app-password>
SMTP_FROM=noreply@jpslogistic.com

# ML
MODEL_PATH=ml_artifacts/xgboost_model_v1.joblib
PREDICTION_TIMEOUT_SECONDS=10

# MLflow
MLFLOW_TRACKING_URI=sqlite:///mlflow.db

# Frontend URL (CORS)
FRONTEND_URL=https://jps-freight.onrender.com

# General
ENVIRONMENT=development
```

### 14.2 Docker Compose

```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      - db
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: jps_user
      POSTGRES_PASSWORD: jps_pass
      POSTGRES_DB: jps_freight
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## 15. Orden de Implementación Recomendado

### Fase 1 — Cimientos (Sprint 1)

1. Inicializar monorepo con Docker Compose
2. Configurar FastAPI + SQLAlchemy + Alembic + PostgreSQL
3. Crear modelos ORM: `users`, `audit_log`
4. Implementar auth: login, JWT, bcrypt, logout, refresh token
5. Implementar recuperación y restablecimiento de contraseña
6. Configurar React + Vite + Tailwind + React Router
7. Crear LoginPage, ForgotPasswordPage, ResetPasswordPage
8. Implementar cierre de sesión por inactividad (frontend timer)

### Fase 2 — Admin de Usuarios (Sprint 2)

1. CRUD de usuarios (crear, editar, deshabilitar, cambiar rol)
2. Bloqueo por 5 intentos fallidos + email de notificación
3. AdminPage con tabla de usuarios
4. RBAC middleware en backend
5. ProtectedRoute en frontend

### Fase 3 — Motor de Predicción (Sprint 3)

1. Entrenar modelo XGBoost en Colab (notebook 03)
2. Exportar modelo serializado (.joblib)
3. Implementar `prediction_service.py` + SHAP explainer
4. Crear endpoint `/api/predictions/estimate`
5. Crear tablas `ports`, `container_types` + seed data
6. Crear NewQuotationPage con formulario completo
7. Validación en tiempo real (React Hook Form + Zod)
8. Spinner de carga + timeout 10s
9. Mostrar resultado: costo USD, intervalo confianza

### Fase 4 — Cotizaciones (Sprint 4)

1. Top 3 SHAP en lenguaje de negocio
2. Guardar cotización en BD
3. Toast de confirmación
4. Campo de notas opcional
5. Generación de PDF con logo JPS
6. Descarga automática: `Cotizacion_JPS_[ID]_[FECHA].pdf`

### Fase 5 — Historial (Sprint 5)

1. Tabla de historial con paginación
2. Ordenamiento por columnas
3. Filtro por rango de fechas
4. Vista consolidada para Analista (columna "Operador")
5. HistoryPage completa

### Fase 6 — Gestión Avanzada (Sprint 6)

1. Búsqueda por ID
2. Modal "Registrar Costo Real"
3. Cálculo automático MAPE individual
4. Cambio de estado Pendiente → Cerrada
5. Badges de estado (amarillo/verde)
6. Filtro por estado

### Fase 7 — Dashboard Estratégico (Sprint 7)

1. Endpoint datos para barras agrupadas (estimado vs real, 6 meses)
2. Endpoint MAPE global
3. Endpoint distribución por puerto
4. Gráfico de barras con Recharts
5. KPI card MAPE (verde/rojo)
6. Pie chart puertos
7. Exportar historial Excel/CSV

### Fase 8 — Mantenimiento y Cierre (Sprint 8)

1. Interfaz carga CSV (preview + validación + confirmación)
2. Indicador "Última actualización" en panel admin
3. Pantalla FAQ
4. Pruebas de integración y usabilidad
5. Documentación final

---

## 16. Convenciones de Código

### Backend (Python)

- **Formatter:** Black (88 chars)
- **Linter:** Ruff
- **Type hints:** obligatorios en todos los parámetros y retornos
- **Naming:** snake_case para funciones/variables, PascalCase para clases
- **Docstrings:** Google style en funciones de servicio
- **Tests:** pytest, fixtures para DB mock, target ≥ 70% coverage

### Frontend (TypeScript/React)

- **Formatter:** Prettier
- **Linter:** ESLint con config de Airbnb/TypeScript
- **Componentes:** Functional con hooks, archivos .tsx
- **Naming:** PascalCase para componentes, camelCase para funciones/variables
- **Estilos:** Tailwind utility classes (no CSS custom salvo excepciones)

### Git

- **Branch strategy:** `main` → `develop` → `feature/HU-XX-descripcion`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- **PR obligatorio** para merge a develop

---

## 17. Notas Importantes

1. **AWS vs Railway/Render:** La documentación académica menciona AWS en los diagramas. El deploy real es en Railway (backend/DB) y Render (frontend). En el código, mantener la infraestructura genérica con Docker para portabilidad (RNF-07).

2. **Dataset limitado:** 500 filas puede no ser suficiente. Considerar técnicas de augmentación o weighted sampling. El modelo debe validarse con al menos 12 meses de datos para capturar estacionalidad.

3. **Variables externas aún no integradas:** SCFI, bunker fuel, SOL/USD y surcharges necesitan un script de descarga/merge. Fuentes: Shanghai Shipping Exchange, BCRP, World Bank Pink Sheet.

4. **MLflow:** Usar para registrar cada experimento de entrenamiento (hiperparámetros, métricas, versión del dataset). El modelo en producción se carga desde `ml_artifacts/`.

5. **PDF de cotización:** Debe incluir: logo JPS Logistic, datos del embarque, costo estimado, intervalo de confianza, top 3 SHAP, fecha de generación. Nombre: `Cotizacion_JPS_[ID]_[FECHA].pdf`.

6. **Inactividad 30 min:** Implementar en frontend con un timer que se reinicia en cada interacción. Al expirar, llama a logout y redirige a login con mensaje.

7. **Mensajes de seguridad genéricos:** En login fallido y en recuperación de contraseña, siempre mostrar mensajes genéricos que no revelen si el email existe o no.
