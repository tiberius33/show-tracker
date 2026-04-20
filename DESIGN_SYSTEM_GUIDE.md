# MySetlists Design System Guide

**For use with Claude Design and other design tools**

## 🎯 Purpose
This guide ensures all design work for mysetlists.net is compatible with our tech stack and drops directly into the codebase without conversion.

---

## 🛠 Tech Stack

### Framework
- **React 18** (Create React App, NOT Next.js)
- Standard functional components with hooks
- No server components or app router

### Deployment
- **Netlify** (static hosting with serverless functions)
- CI/CD auto-deploy from GitHub main branch
- Environment variables in Netlify dashboard

### Styling
- **Tailwind CSS** (utility-first)
- Custom brand colors defined in `tailwind.config.js`
- Dark theme default with light accents

### Authentication
- **Firebase Auth** (Google, Apple, Email/Password)
- Custom `useAuth()` hook in `src/hooks/useAuth.js`
- NO next-auth or other auth libraries

### Routing
- **React Router v6** (client-side routing)
- Standard `<Link to="">` components
- `useNavigate()` hook for programmatic navigation

### State Management
- React Context + hooks
- LocalStorage for persistence
- No Redux or external state libraries

---

## 🎨 Brand Identity

### Colors

**Primary Palette:**
```javascript
// Green (from logo pin)
primary: '#34D399'      // Emerald green
primaryDark: '#2AB384'  // Hover state

// Orange (from "setlists" text)
accent: '#FB923C'       // Orange
accentDark: '#EA8530'   // Hover state

// Background
bgDark: '#0F172A'       // Navy/dark blue
bgCard: '#1E293B'       // Card background
bgInput: '#0F172A'      // Input fields

// Text
textPrimary: '#F8FAFC'  // Almost white
textSecondary: '#94A3B8' // Light gray
textTertiary: '#64748B'  // Medium gray
```

**Usage:**
- Buttons: Green background (#34D399) with black or orange text
- Accent text: Orange (#FB923C) for "setlists" in logo
- Backgrounds: Dark navy (#0F172A) with lighter cards (#1E293B)

### Typography

**Font Family:**
- Primary: `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`
- Monospace: `'Courier New', monospace` (for song numbers, stats)

**Scale:**
```
Text XS:  12px (0.75rem)
Text SM:  14px (0.875rem)
Text Base: 16px (1rem)
Text LG:  18px (1.125rem)
Text XL:  20px (1.25rem)
Text 2XL: 24px (1.5rem)
Text 3XL: 30px (1.875rem)
```

### Logo Usage

**Components:**
- Green location pin icon with white horizontal lines (represents setlists)
- "mysetlists" wordmark: "my" in gray, "setlists" in orange, ".net" in gray
- Tagline: "Your Show History" in gray

**Files:**
- SVG logo: High quality, scalable
- PNG icons: 192x192, 512x512 for PWA/favicons

---

## 📁 File Structure

```
src/
  components/
    brand/              # Logo, wordmark, brand elements
      Logo.jsx
      Wordmark.jsx
      Icon.jsx
    marketing/          # Landing pages, public-facing
      LandingPage.jsx
      Hero.jsx
      Features.jsx
      Pricing.jsx
    ui/                 # Reusable UI components
      Button.jsx
      Card.jsx
      Modal.jsx
      Input.jsx
      Tooltip.jsx
    shows/              # Show-specific components
      ShowCard.jsx
      SetlistEditor.jsx
      ShowModal.jsx
    stats/              # Statistics components
      StatsView.jsx
      SongStats.jsx
    friends/            # Social features
      FriendsList.jsx
      FriendRequests.jsx
  hooks/
    useAuth.js          # Firebase authentication
    useShows.js         # Show data management
  pages/
    Shows.jsx
    Stats.jsx
    Profile.jsx
    Friends.jsx
  utils/
    api.js              # API helpers
  netlify/
    functions/          # Serverless functions (.mts files)
```

---

## ✅ Component Guidelines

### DO:

✓ Use standard React functional components
✓ Use `<img src={} alt={} />` for images
✓ Use `<a href={}>` or `<Link to={}>` from React Router
✓ Import only from 'react' and 'react-router-dom'
✓ Use Tailwind classes for all styling
✓ Use Firebase `useAuth()` hook for auth state
✓ Export as default: `export default function ComponentName() {}`
✓ Use semantic HTML (article, section, nav, etc.)
✓ Include proper aria labels for accessibility

### DON'T:

✗ Use Next.js imports (next/image, next/link, next/router)
✗ Use next-auth or any Next.js-specific patterns
✗ Use server components or getServerSideProps
✗ Use CSS modules or styled-components
✗ Hardcode colors (use Tailwind classes)
✗ Use class components (only functional components)

---

## 🔐 Authentication Pattern

**Our Firebase Auth Hook:**

```javascript
import { useAuth } from '../hooks/useAuth';

function MyComponent() {
  const { currentUser, loading, signOut } = useAuth();

  if (loading) return <LoadingSpinner />;
  
  if (!currentUser) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <p>Welcome, {currentUser.displayName}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

**Auth Gates:**

```javascript
// Protect routes that require login
function ProtectedPage() {
  const { currentUser, loading } = useAuth();

  if (loading) return <Loading />;
  if (!currentUser) return <Navigate to="/" />;
  
  return <Dashboard />;
}
```

---

## 🎨 Component Examples

### Button Component

```jsx
import React from 'react';

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = ''
}) {
  const baseStyles = 'rounded-lg font-semibold transition-all duration-200';
  
  const variants = {
    primary: 'bg-emerald-400 text-black hover:bg-emerald-500',
    secondary: 'bg-gray-700 text-white hover:bg-gray-600',
    accent: 'bg-orange-400 text-black hover:bg-orange-500',
    outline: 'border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
```

### Card Component

```jsx
import React from 'react';

export default function Card({ 
  children, 
  className = '',
  onClick,
  hover = false 
}) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-gray-800 
        border border-gray-700 
        rounded-lg 
        p-4
        ${hover ? 'hover:border-gray-600 cursor-pointer transition-all' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
```

### Modal Component

```jsx
import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
```

---

## 🎯 Design Patterns

### Responsive Design

**Breakpoints:**
```
sm:  640px   (mobile landscape)
md:  768px   (tablet)
lg:  1024px  (laptop)
xl:  1280px  (desktop)
2xl: 1536px  (large desktop)
```

**Mobile-First Approach:**
```jsx
<div className="
  w-full           // Mobile: full width
  md:w-1/2         // Tablet: half width
  lg:w-1/3         // Desktop: one-third width
  px-4             // Mobile padding
  md:px-6          // Tablet padding
  lg:px-8          // Desktop padding
">
  Content
</div>
```

### Dark Theme

All components use dark theme by default:
- Backgrounds: Navy/dark blue
- Cards: Slightly lighter than background
- Text: White/light gray
- Borders: Subtle gray

### Loading States

```jsx
{loading && (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
  </div>
)}
```

### Empty States

```jsx
<div className="text-center py-12 text-gray-500">
  <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
  <p className="text-lg mb-2">No shows yet</p>
  <p className="text-sm">Add your first show to get started!</p>
</div>
```

---

## 🔧 Icons

**Library:** Lucide React (`lucide-react`)

**Installation:**
```bash
npm install lucide-react
```

**Usage:**
```jsx
import { Music, Star, Calendar, MapPin, User, Search } from 'lucide-react';

<Music className="w-5 h-5 text-emerald-400" />
<Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
```

**Common Icons:**
- Music: Shows, songs
- Star: Ratings, favorites
- Calendar: Dates
- MapPin: Venues
- User/Users: Friends, profile
- Search: Search functionality
- Plus: Add new items
- X: Close, delete

---

## 🌐 Netlify Functions

**Pattern:**
```javascript
// netlify/functions/function-name.mts
exports.handler = async (event, context) => {
  try {
    const data = JSON.parse(event.body);
    
    // Process data
    const result = await someAPICall(data);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**Calling from Frontend:**
```javascript
const response = await fetch('/.netlify/functions/function-name', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

const result = await response.json();
```

---

## 📦 Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.x",
    "lucide-react": "^0.x",
    "firebase": "^10.x"
  },
  "devDependencies": {
    "tailwindcss": "^3.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x"
  }
}
```

---

## 🚀 Quick Start Checklist

When starting a new design in Claude Design:

1. ✅ Upload this `DESIGN_SYSTEM_GUIDE.md` file
2. ✅ Specify: "React 18 app, NOT Next.js"
3. ✅ Request: "Components should use standard React patterns"
4. ✅ Confirm: "Use Tailwind classes from this guide"
5. ✅ Verify: No Next.js imports in generated code

---

## 🎨 Example Design Request

**Good Request:**
```
Create a landing page for mysetlists.net following the design guide.

Requirements:
- React component (not Next.js)
- Use brand colors: green (#34D399) and orange (#FB923C)
- Dark theme with navy background
- Mobile-responsive
- Include hero section, features grid, and CTA
- Use Tailwind classes only
- Import icons from lucide-react
```

**Bad Request:**
```
Create a landing page with Next.js Image and next-auth
```

---

## 📝 Notes

- All components should be **functional** with hooks
- Use **Tailwind classes** exclusively (no inline styles or CSS modules)
- Keep components **small and focused** (single responsibility)
- Always include **proper TypeScript types** or PropTypes if requested
- Components should be **accessible** (ARIA labels, semantic HTML)
- Test on **mobile and desktop** before finalizing

---

## 🔗 Resources

- Live Site: https://mysetlists.net
- GitHub: https://github.com/tiberius33/show-tracker
- Deployment: Netlify (auto-deploy from main)
- Design Assets: SVG logos in `/public`

---

**Last Updated:** April 2026
**Maintainer:** Phillip Leonard
**Contact:** For questions about the design system, open an issue on GitHub
