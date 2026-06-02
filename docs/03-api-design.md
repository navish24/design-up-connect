# Designup Connect — API Design

> **Purpose**: Reference for all API endpoints the mobile app and web portals call. Supabase auto-generates CRUD endpoints for all tables — this document covers the **custom logic endpoints** (Supabase Edge Functions) and the **calling patterns** the frontend should follow.

---

## Base URL

```
Production:  https://{project-ref}.supabase.co
Development: http://localhost:54321
```

All requests require an `Authorization: Bearer {jwt_token}` header (issued by Supabase Auth after OTP verification).

---

## Authentication

### Send OTP
```
POST /functions/v1/auth/send-otp

Body:
{
  "phone": "+919876543210"
}

Response 200:
{
  "success": true,
  "expires_in": 300  // seconds
}
```

### Verify OTP
```
POST /functions/v1/auth/verify-otp

Body:
{
  "phone": "+919876543210",
  "otp": "123456"
}

Response 200:
{
  "access_token": "...",
  "refresh_token": "...",
  "user": { ...user object... },
  "is_new_user": true  // if true, redirect to sign-up profile completion
}
```

### Complete Sign-Up Profile
```
POST /functions/v1/auth/complete-profile

Body:
{
  "first_name": "Rohan",
  "last_name": "Mehta",
  "email": "rohan@lumina.com",
  "designup_user_id": "rohan_lumina",
  "profession": "Interior Designer",
  "company_name": "Studio Lumina",
  "designation": "Principal Designer",
  "city": "Mumbai",
  "country": "India",
  "year_of_birth": 1990
}

Response 200:
{
  "user": { ...complete user object... },
  "visiting_card_created": true
}
```

**Note**: On successful profile completion, the system auto-generates the user's personal QR code and visiting card — stored back on the user record.

---

## Users

### Get My Profile
```
GET /rest/v1/users?id=eq.{user_id}&select=*
// (Supabase auto-generated)
```

### Update My Profile
```
PATCH /rest/v1/users?id=eq.{user_id}

Body: { any updatable fields }
```

### Check Username Availability
```
GET /functions/v1/users/check-username?handle=rohan_lumina

Response 200:
{
  "available": true
}
```

### Get Public Profile (for visiting card view)
```
GET /functions/v1/users/{designup_user_id}/public

Response 200:
{
  "id": "...",
  "designup_user_id": "rohan_lumina",
  "full_name": "Rohan Mehta",
  "profession": "Interior Designer",
  "company_name": "Studio Lumina",
  "designation": "Principal Designer",
  "city": "Mumbai",
  "linkedin_url": "...",
  "instagram_handle": "...",
  "website_url": "...",
  "profile_image_url": "..."
  // email and phone are NOT returned
}
```

---

## Exhibitions

### List Exhibitions (Home Screen + Exhibition List)
```
GET /functions/v1/exhibitions?city=Mumbai&status=upcoming&limit=10&offset=0

Response 200:
{
  "exhibitions": [
    {
      "id": "...",
      "name": "Index Mumbai 2025",
      "tagline": "...",
      "start_date": "2025-11-15",
      "end_date": "2025-11-18",
      "timings": "10:00 AM – 7:00 PM",
      "venue_name": "Bombay Exhibition Centre",
      "city": "Mumbai",
      "status": "upcoming",
      "is_paid": false,
      "user_registration_status": "registered",  // null if not registered
      "brand_count": 150
    }
  ],
  "total": 45
}
```

**Note**: `user_registration_status` is computed per-user. Registered exhibitions appear first on the Home screen (sorted in response).

### Get Exhibition Detail
```
GET /functions/v1/exhibitions/{exhibition_id}

Response 200:
{
  "id": "...",
  "name": "Index Mumbai 2025",
  "about": "...",
  "start_date": "2025-11-15",
  "end_date": "2025-11-18",
  "timings": "...",
  "venue_name": "...",
  "venue_address": "...",
  "layout_map_url": "...",
  "stats": {
    "cities": 50,
    "brands": 150
  },
  "brands_preview": [...],  // first 15 brands for carousel
  "user_registration": {    // null if not registered
    "status": "registered",
    "entry_qr_url": "..."
  }
}
```

### Register for Exhibition
```
POST /functions/v1/exhibitions/{exhibition_id}/register

Body:
{
  "visitor_category": "Interior Designer",
  "registration_type": "free",             // free | free_pass
  "free_pass_token": "abc123"              // only if registration_type is free_pass
}

Response 200:
{
  "registration": {
    "id": "...",
    "status": "registered",
    "entry_qr_url": "...",
    "entry_qr_data": "entry:{registration_id}"
  }
}
```

### Get My Ticket
```
GET /functions/v1/exhibitions/{exhibition_id}/my-ticket

Response 200:
{
  "exhibition_name": "Index Mumbai 2025",
  "start_date": "...",
  "end_date": "...",
  "timings": "...",
  "venue_name": "...",
  "entry_qr_url": "...",
  "status": "registered"   // registered | checked_in
}
```

---

## Universal Scanner — Core Endpoint

This is the most important endpoint in the system. The mobile app sends every QR scan here and the backend decides what to do.

### Process Scan
```
POST /functions/v1/scan

Body:
{
  "qr_data": "booth:exhibition-uuid:brand-uuid",
  "active_exhibition_id": "exhibition-uuid"   // the currently active exhibition on user's dashboard
}

Response — Brand Scan (booth QR):
{
  "scan_type": "booth",
  "action": "brand_saved",          // or "already_saved"
  "brand": {
    "id": "...",
    "name": "Lumina Lighting",
    "category": "Lighting",
    "tagline": "Light that tells stories",
    "booth_number": "B12",
    "hall_number": "Hall 2",
    "exhibition_name": "Index Mumbai 2025",
    "product_images": ["url1", "url2"]   // first 2 images for success screen
  }
}

Response — Personal QR Scan (connection):
{
  "scan_type": "personal",
  "action": "connection_created",    // or "already_connected"
  "connection": {
    "id": "...",
    "user": {
      "full_name": "Priya Sharma",
      "designation": "...",
      "company_name": "...",
      "designup_user_id": "priya_sharma"
    },
    "contact_shared": true,
    "is_mutual": false
  }
}

Response — Entry QR Scan (gate activation):
{
  "scan_type": "entry",
  "action": "exhibition_activated",
  "exhibition": {
    "id": "...",
    "name": "Index Mumbai 2025"
  }
}

Error Response 400:
{
  "error": "invalid_qr",
  "message": "This QR code is not recognized"
}

Error Response 403:
{
  "error": "no_active_exhibition",
  "message": "You need to be checked in to an exhibition to save brands"
}
```

**QR Data Format Reference:**

| QR Type | Encoded String Format | Action |
|---|---|---|
| Booth QR | `booth:{exhibition_id}:{brand_id}` | Save brand to visitor's library |
| Personal / Visiting QR | `user:{user_id}` | Create connection between two users |
| Entry Pass QR | `entry:{registration_id}` | Mark visitor checked-in, activate exhibition |

---

## Saved Brands

### Get All Saved Brands (grouped by exhibition)
```
GET /functions/v1/saved-brands

Response 200:
{
  "exhibitions": [
    {
      "exhibition_id": "...",
      "exhibition_name": "Index Mumbai 2025",
      "exhibition_status": "past",
      "saved_brands": [
        {
          "saved_brand_id": "...",
          "brand_id": "...",
          "name": "Lumina Lighting",
          "category": "Lighting",
          "tagline": "...",
          "product_image_url": "..."    // first product image for card thumbnail
        }
      ]
    }
  ]
}
```

### Get Brand Detail (from Saved context)
```
GET /functions/v1/brands/{brand_id}?exhibition_id={exhibition_id}

Response 200:
{
  "id": "...",
  "name": "Lumina Lighting",
  "category": "Lighting",
  "tagline": "...",
  "story": "...",
  "booth_number": "B12",
  "hall_number": "Hall 2",
  "visiting_card": {               // only present if user has scanned this brand
    "contact_name": "...",
    "email": "...",
    "phone": "...",
    "website_url": "..."
  },
  "products": [
    {
      "id": "...",
      "name": "...",
      "images": [{ "id": "...", "url": "...", "is_wishlisted": false }]
    }
  ]
}
```

### Add Notes to Saved Brand
```
PATCH /functions/v1/saved-brands/{saved_brand_id}/notes

Body:
{
  "notes": "Interesting chandelier options for villa project"
}
```

---

## Connections

### List Connections
```
GET /functions/v1/connections?search=priya&limit=20&offset=0

Response 200:
{
  "connections": [
    {
      "id": "...",
      "user": {
        "full_name": "Priya Sharma",
        "designup_user_id": "priya_sharma",
        "brand_name": "Studio Forma",
        "designation": "Principal",
        "city": "Mumbai"
      },
      "connection_type": "networking",
      "is_mutual": false,
      "from_contact_shared": false,
      "to_contact_shared": true,
      "created_at": "2025-11-16T14:30:00Z"
    }
  ]
}
```

### Get Connection Detail (Contact Details Page)
```
GET /functions/v1/connections/{connection_id}

Response 200:
{
  "id": "...",
  "user": {
    "full_name": "Priya Sharma",
    "brand_name": "Studio Forma",
    "designation": "Principal Designer",
    "email": "priya@studioforma.com",    // only if contact is shared
    "phone": "+91...",                   // only if contact is shared
    "linkedin_url": "...",
    "instagram_handle": "...",
    "website_url": "...",
    "city": "Mumbai",
    "country": "India"
  },
  "is_mutual": false,
  "can_exchange_contact": true
}
```

### Exchange Contact
```
POST /functions/v1/connections/{connection_id}/exchange-contact

Response 200:
{
  "success": true,
  "is_mutual": true,
  "message": "Your contact has been shared with Priya Sharma"
}
```
**What this does internally:**
1. Sets `from_contact_shared = true` on the connection
2. Sets `is_mutual = true`
3. Sends a notification to the other user: "Rohan Mehta shared their contact with you"

### Update Notes on Connection
```
PATCH /functions/v1/connections/{connection_id}/notes

Body:
{
  "notes": "Met at Index Mumbai. Working on luxury villa — follow up next week."
}
```

---

## Wishlist

### Get Wishlist
```
GET /functions/v1/wishlist

Response 200:
{
  "items": [
    {
      "wishlist_id": "...",
      "product_image_url": "...",
      "product_name": "Aria Pendant Light",
      "brand_name": "Lumina Lighting",
      "brand_id": "...",
      "product_id": "...",
      "material": "Brass + Blown Glass",
      "dimensions": "30cm diameter"
    }
  ]
}
```

### Add to Wishlist
```
POST /functions/v1/wishlist

Body:
{
  "product_id": "...",
  "product_image_id": "..."
}

Response 200:
{
  "wishlist_id": "...",
  "success": true
}

Response 200 (already wishlisted):
{
  "wishlist_id": "...",
  "already_wishlisted": true
}
```

### Remove from Wishlist
```
DELETE /functions/v1/wishlist/{wishlist_id}

Response 200:
{
  "success": true
}
```

---

## Free Passes

### Send Free Pass Invitation
```
POST /functions/v1/exhibitions/{exhibition_id}/passes/send

Body:
{
  "recipient_email": "client@email.com",
  "recipient_phone": "+919876543210"
}

Response 200:
{
  "token": "abc123xyz",
  "passes_remaining": 16,
  "sent_via": ["email", "whatsapp"]
}

Response 400:
{
  "error": "no_passes_remaining",
  "message": "You have used all your allocated passes for this exhibition"
}
```

### Get Pass Allocation Status
```
GET /functions/v1/exhibitions/{exhibition_id}/passes/status

Response 200:
{
  "allocated": 20,
  "used": 3,
  "remaining": 17,
  "sent_passes": [
    {
      "token_id": "...",
      "recipient_email": "client@...",
      "sent_at": "...",
      "used": false
    }
  ]
}
```

---

## Notifications

### Get Notifications
```
GET /functions/v1/notifications?limit=20&offset=0

Response 200:
{
  "notifications": [
    {
      "id": "...",
      "type": "contact_received",
      "title": "Priya Sharma received your contact",
      "body": "...",
      "is_read": false,
      "created_at": "..."
    }
  ],
  "unread_count": 3
}
```

### Mark Notification as Read
```
PATCH /functions/v1/notifications/{notification_id}/read
```

### Mark All Read
```
POST /functions/v1/notifications/mark-all-read
```

---

## Admin Endpoints (Designup Internal)

### Create Exhibition
```
POST /functions/v1/admin/exhibitions

Body:
{
  "name": "Index Mumbai 2025",
  "tagline": "...",
  "about": "...",
  "start_date": "2025-11-15",
  "end_date": "2025-11-18",
  "timings": "10:00 AM – 7:00 PM",
  "venue_name": "Bombay Exhibition Centre",
  "venue_address": "...",
  "city": "Mumbai",
  "country": "India",
  "organizer_email": "organizer@indexmumbai.com"
}
```

### Upload Brand List (Organizer)
```
POST /functions/v1/admin/exhibitions/{exhibition_id}/brands/bulk

Body:
{
  "brands": [
    {
      "name": "Lumina Lighting",
      "category": "Lighting",
      "email": "info@lumina.com",
      "phone": "+91...",
      "booth_number": "B12",
      "hall_number": "Hall 2"
    }
  ]
}

Response 200:
{
  "created": 45,
  "invited": 45,
  "errors": []
}
```

### Allocate Free Passes to Brand
```
POST /functions/v1/admin/exhibitions/{exhibition_id}/brands/{brand_id}/passes

Body:
{
  "allocated_count": 20
}
```

---

## Brand Onboarding Endpoints

### Complete Brand Profile (from email invite link)
```
POST /functions/v1/brands/{brand_id}/onboarding

Body:
{
  "story": "...",
  "tagline": "...",
  "website_url": "...",
  "logo_url": "...",    // Cloudinary URL after direct upload
  "catalogue_url": "...",
  "catalogue_is_private": true
}
```

### Add Brand Team Member
```
POST /functions/v1/brands/{brand_id}/team

Body:
{
  "designup_user_id": "priya_studioforma"  // or email
}

Response 200:
{
  "member": { ...user object... },
  "role": "member"
}
```

### Set Active Exhibition Team
```
PUT /functions/v1/brands/{brand_id}/exhibitions/{exhibition_id}/team

Body:
{
  "user_ids": ["uuid1", "uuid2", "uuid3"]   // replaces entire active team list
}
```

### Get Booth QR (after onboarding complete)
```
GET /functions/v1/brands/{brand_id}/exhibitions/{exhibition_id}/qr

Response 200:
{
  "qr_code_url": "https://res.cloudinary.com/...",   // printable QR image
  "qr_code_data": "booth:exhibition-uuid:brand-uuid"
}
```

---

## Supabase Realtime Subscriptions (Mobile)

For features that need live updates (future-ready, use in Phase 2 for messaging):

```javascript
// Subscribe to new notifications
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${currentUserId}`
  }, (payload) => {
    // update notification badge count
  })
  .subscribe()
```

---

## Error Response Format

All API errors follow a consistent format:

```json
{
  "error": "error_code",        // machine-readable snake_case
  "message": "Human readable description",
  "details": {}                 // optional additional context
}
```

Common error codes:
| Code | HTTP Status | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing or invalid JWT token |
| `forbidden` | 403 | Authenticated but not allowed |
| `not_found` | 404 | Resource doesn't exist |
| `already_exists` | 409 | Duplicate (e.g., already registered for exhibition) |
| `validation_error` | 422 | Invalid input fields |
| `no_active_exhibition` | 400 | Scanning attempted without active exhibition |
| `invalid_qr` | 400 | QR code format not recognized |
| `no_passes_remaining` | 400 | Brand has no free passes left |
