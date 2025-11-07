# StayNest - Vacation Rental Platform

A realistic Airbnb-style example project for testing code analysis and design system extraction.

## About This Project

StayNest is an intentionally "messy" but functional vacation rental platform built to simulate real-world projects with:
- **Mixed styling approaches** (MUI theme, inline styles, CSS modules, hardcoded values)
- **Inconsistent component patterns** (custom Button alongside MUI Button)
- **Scattered component organization** (some in `/components`, others in pages)
- **No clear design system folder** (unlike typical well-organized projects)

This makes it perfect for training AI systems to extract design patterns from less-than-perfect codebases.

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Material-UI (MUI)** as the primary UI library
- **React Router** for navigation
- **Axios** for API calls
- **CSS Modules** for some components

### Backend
- **Node.js** with Express
- **TypeScript**
- **In-memory data storage** (no database required)
- **CORS** enabled for cross-origin requests

## Project Structure

```
staynest-homes/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx              # Landing page with hero
│   │   │   ├── PropertyList.tsx      # Browse all properties
│   │   │   ├── PropertyDetail.tsx    # Property details & booking
│   │   │   └── Profile.tsx           # User profile & trips
│   │   ├── components/
│   │   │   ├── Header.tsx            # Custom styled header
│   │   │   ├── Footer.tsx            # MUI + inline styles
│   │   │   ├── Button.tsx            # Custom button (redundant with MUI)
│   │   │   ├── PropertyCard.tsx      # MUI-based card
│   │   │   ├── SearchBar.tsx         # CSS modules
│   │   │   └── BookingWidget.tsx     # Mixed styling
│   │   ├── api/
│   │   │   └── client.ts             # API client setup
│   │   ├── theme.ts                  # Basic MUI theme
│   │   ├── types.ts                  # TypeScript interfaces
│   │   ├── App.tsx                   # Main app & routing
│   │   └── main.tsx                  # Entry point
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── properties.ts         # Property endpoints
│   │   │   ├── users.ts              # User endpoints
│   │   │   ├── bookings.ts           # Booking endpoints
│   │   │   ├── reviews.ts            # Review endpoints
│   │   │   └── amenities.ts          # Amenities list
│   │   ├── data/
│   │   │   ├── properties.ts         # 18 mock properties
│   │   │   ├── users.ts              # 5 mock users
│   │   │   └── bookings.ts           # Mock bookings & reviews
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript interfaces
│   │   └── index.ts                  # Express server setup
│   └── package.json
└── README.md
```

## Features

### Property Browsing
- Home page with featured properties
- Search by location
- Filter by property type (apartment, house, villa, cabin, condo)
- Sort by price and rating
- 18 properties across major cities worldwide

### Property Details
- Image gallery
- Full property description
- Host information
- Amenities list
- Guest reviews
- Booking widget with date selection

### User Profiles
- View user information
- See booking history
- Host/Guest badges

### API Endpoints

#### Properties
- `GET /api/properties` - Get all properties
- `GET /api/properties/:id` - Get property by ID
- `GET /api/properties/search` - Search with filters (location, guests, price, type, amenities)
- `POST /api/properties` - Create new property

#### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user

#### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/user/:userId` - Get user's bookings
- `GET /api/bookings/property/:propertyId` - Get property's bookings
- `POST /api/bookings` - Create new booking
- `PATCH /api/bookings/:id` - Update booking status

#### Reviews
- `GET /api/reviews` - Get all reviews
- `GET /api/reviews/property/:propertyId` - Get property reviews
- `POST /api/reviews` - Create new review

#### Amenities
- `GET /api/amenities` - Get all available amenities

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Install all dependencies:**
```bash
npm install
```

This will install dependencies for both frontend and backend (using workspaces).

2. **Start the backend server:**
```bash
npm run dev:backend
```
Backend will run on `http://localhost:3001`

3. **In a new terminal, start the frontend:**
```bash
npm run dev:frontend
```
Frontend will run on `http://localhost:3000`

4. **Or start both together:**
```bash
npm run dev
```

### Quick Start Commands

```bash
# Install all dependencies
npm install

# Run both frontend and backend
npm run dev

# Run only frontend
npm run dev:frontend

# Run only backend
npm run dev:backend

# Build both
npm run build
```

## Design System Characteristics

This project intentionally has **no dedicated design system folder**, but uses design patterns that should be extractable:

### Color Palette
- Primary: `#FF5A5F` (coral red)
- Secondary: `#00A699` (teal)
- Text Primary: `#484848`
- Text Secondary: `#767676`
- Background: `#FFFFFF`, `#F7F7F7`

### Typography
- Font: Poppins (via Google Fonts)
- Headings: 600-700 weight
- Body: 400 weight

### Spacing
- Base unit: 8px (though not consistently applied)
- Common values: 8px, 16px, 24px, 32px, 40px, 48px, 60px

### Components
- **Buttons**: Custom Button component + MUI Button
- **Cards**: Mix of custom cards and MUI Card
- **Navigation**: Custom Header with hardcoded styles
- **Forms**: Mostly MUI TextField
- **Layout**: Mix of MUI Grid/Container and custom CSS

### Styling Approaches Used
1. **MUI sx prop** - PropertyCard, PropertyDetail
2. **Inline styles** - Header, BookingWidget
3. **CSS Modules** - SearchBar
4. **MUI theme** - Basic theme, not fully utilized
5. **Hardcoded values** - Scattered throughout

## API Examples

### Search for properties in Paris
```bash
curl "http://localhost:3001/api/properties/search?location=Paris"
```

### Get property details
```bash
curl "http://localhost:3001/api/properties/p1"
```

### Create a booking
```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "p1",
    "userId": "u2",
    "checkIn": "2024-12-15",
    "checkOut": "2024-12-20",
    "guests": 2,
    "totalPrice": 900
  }'
```

## Use Case for Customize AI

This project is designed to test the extraction capabilities of Customize AI:

1. **Design System Extraction**
   - Should identify color palette from various sources
   - Should detect typography patterns
   - Should find spacing inconsistencies
   - Should identify component variants

2. **Component Analysis**
   - Should discover duplicate button implementations
   - Should map component relationships
   - Should identify styling patterns

3. **API Surface Detection**
   - Should catalog all REST endpoints
   - Should infer data models from responses
   - Should document query parameters

## Mock Data

The backend includes realistic mock data:
- **18 properties** in cities like New York, Paris, Tokyo, Barcelona, etc.
- **5 users** (mix of hosts and guests)
- **3 bookings** with various statuses
- **8 reviews** with ratings and comments
- **28 amenities** types

## License

MIT - This is an example project for testing purposes.

