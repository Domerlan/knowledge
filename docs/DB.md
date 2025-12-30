# Database Schema (MVP)

All IDs are stored as `CHAR(36)` UUID strings.

## users
- id (PK, char(36))
- username (unique, @name)
- password_hash
- role (user|moderator|admin)
- telegram_id (nullable, unique)
- is_active
- created_at

Indexes:
- unique username
- unique telegram_id

## sections
- id (PK)
- slug (unique)
- title
- description
- sort_order
- is_visible

Indexes:
- unique slug

## articles
- id (PK)
- section_id (FK -> sections.id)
- slug (unique)
- title
- content (LONGTEXT)
- status (draft|published|archived)
- author_id (FK -> users.id)
- created_at
- updated_at
- published_at

Indexes:
- unique slug
- section_id
- author_id

## comments
- id (PK)
- article_id (FK -> articles.id)
- author_id (FK -> users.id)
- parent_id (nullable, FK -> comments.id)
- content (TEXT)
- is_hidden
- created_at
- updated_at

Indexes:
- article_id
- author_id

## registration_requests
- id (PK)
- username
- password_hash
- telegram_id (nullable)
- code_hash (unique)
- expires_at
- attempts
- status (pending|approved|expired|rejected)
- created_at

Indexes:
- code_hash (unique)
- username

## installation_state
- id (PK)
- installed_at
- admin_user_id (nullable, FK -> users.id)
- seed_applied

## game_updates
- id (PK)
- title
- patch_date (DATE)
- content (HTML)
- status (draft|published|archived)
- created_by_id (FK -> users.id)
- updated_by_id (nullable, FK -> users.id)
- published_by_id (nullable, FK -> users.id)
- created_at
- updated_at
- published_at
- deleted_at (soft delete)

Indexes:
- patch_date
- status
- deleted_at
- created_by_id

## game_update_audits
- id (PK)
- update_id (FK -> game_updates.id)
- actor_id (FK -> users.id)
- action
- metadata (JSON)
- created_at

Indexes:
- update_id
- actor_id
