## Aurora Rides Reference App

Aurora Rides is a sample ride-hailing platform built to showcase how Customize can analyze a real-world stack. It includes a modern React frontend with a themed design system, an Express backend with documented APIs, and shared domain models you can extend for experiments and agent training.

### Project Structure

```
aurora-rides/
├── README.md
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── bookings.ts
│   │   │   ├── drivers.ts
│   │   │   └── rides.ts
│   │   ├── data/
│   │   │   ├── drivers.ts
│   │   │   ├── rides.ts
│   │   │   └── bookings.ts
│   │   ├── lib/
│   │   │   └── analytics.ts
│   │   └── openapi.yaml
│   └── tsconfig.json
└── frontend/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── router.tsx
        ├── design-system/
        │   ├── index.ts
        │   ├── theme.ts
        │   ├── components/
        │   │   ├── button.tsx
        │   │   ├── card.tsx
        │   │   ├── input.tsx
        │   │   ├── tag.tsx
        │   │   └── layout.tsx
        │   └── docs/
        │       └── DesignSystemDocs.tsx
        ├── api/
        │   ├── client.ts
        │   └── hooks.ts
        ├── features/
        │   ├── dashboard/
        │   │   ├── DashboardPage.tsx
        │   │   └── components.tsx
        │   └── rides/
        │       └── RideDetailsPage.tsx
        ├── providers/
        │   └── query-client.tsx
        └── pages/
            ├── HomePage.tsx
            ├── DriversPage.tsx
            └── BookingsPage.tsx
```

> The tree above reflects the intended layout once all plan todos are complete. Some files are created in later steps.

### Getting Started

#### Requirements
- Node.js 20+
- npm 10+

#### Install Dependencies

From the Aurora Rides root directory:

```bash
cd example-projects/aurora-rides

# Install both frontend and backend dependencies
npm install --workspaces
```

Or install individually:

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

#### Run the Backend

```bash
cd backend
npm run dev
```

The backend API will start on `http://localhost:4000`.

**Available endpoints:**
- `GET /api/health` - Health check
- `GET /api/analytics` - Operational metrics
- `GET /api/rides` - List all rides
- `GET /api/rides/:id` - Get ride details
- `POST /api/rides` - Create a ride
- `PATCH /api/rides/:id` - Update ride status
- `GET /api/drivers` - List all drivers
- `GET /api/drivers/:id` - Get driver details
- `PATCH /api/drivers/:id` - Update driver status
- `GET /api/bookings` - List all bookings
- `POST /api/bookings` - Create a booking

See `backend/src/openapi.yaml` for the complete API specification.

#### Run the Frontend

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173`.

**Available routes:**
- `/` - Home page
- `/dashboard` - Operations dashboard with analytics
- `/drivers` - Drivers directory
- `/bookings` - Bookings management
- `/rides/:id` - Ride details page
- `/design-system` - Design system documentation

#### Environment Variables

Both frontend and backend include example environment files:

**Frontend** (`frontend/env.example`):
```env
VITE_API_BASE_URL=http://localhost:4000/api
```

**Backend** (`backend/env.example`):
```env
PORT=4000
```

Copy these to `.env` files if you need to customize the configuration.

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- React Router for routing
- React Query (TanStack Query) for API state management
- Axios for HTTP requests
- Custom design system with CSS variables

**Backend:**
- Node.js with Express
- TypeScript
- In-memory data storage (mocked fixtures)
- CORS enabled for local development
- Morgan for request logging
- OpenAPI 3.1 specification

### Design System

The frontend includes a comprehensive design system located in `frontend/src/design-system/`:

**Theme Tokens** (`theme.ts`):
- Colors (primary, secondary, success, warning, danger)
- Typography (font sizes, weights, line heights)
- Spacing scale
- Border radius values
- Shadows

**Components**:
- `Button` - Multiple variants (primary, secondary, success, danger), sizes, and states
- `Card` - Container with elevation and hover effects
- `Input` - Form input with label support
- `Tag` - Status badges with color variants
- `Grid` - Responsive grid layout system
- `Container` - Page layout wrapper

**Documentation**: Visit `/design-system` in the running app to see all components with live examples.

### Using with Customize

This example project is designed to be analyzed by Customize:

**Analyze the Frontend:**
```bash
# In the Customize admin dashboard
# Upload or provide path: /path/to/example-projects/aurora-rides/frontend
```

The analysis will extract:
- Design system components (Button, Card, Input, Tag, Grid, Container)
- Theme tokens from `theme.ts`
- React Query hooks for API integration
- Page components and routing structure

**Analyze the Backend:**
```bash
# Upload or provide path: /path/to/example-projects/aurora-rides/backend
```

The analysis will discover:
- Express API routes and endpoints
- Data models (Ride, Driver, Booking, Analytics)
- OpenAPI specification
- Analytics utilities

**Use Cases:**
- Train Customize agents on real-world React patterns
- Test design system extraction accuracy
- Validate API surface discovery
- Generate new pages that match the Aurora Rides design language
- Experiment with component variations

### Development

**Backend Development:**
```bash
cd backend
npm run dev     # Run with nodemon (hot reload)
npm run build   # Compile TypeScript
npm start       # Run compiled version
```

**Frontend Development:**
```bash
cd frontend
npm run dev     # Run Vite dev server
npm run build   # Build for production
npm run preview # Preview production build
```

### Data & Fixtures

The backend uses in-memory data fixtures for quick prototyping:
- 5 sample rides with various statuses
- 6 sample drivers with different availability states
- 3 sample bookings
- Analytics computed from ride and driver data

All data resets when the server restarts. Modify fixtures in `backend/src/data/` to customize the sample data.

### License
MIT. Use it as a sandbox for experimentation.

