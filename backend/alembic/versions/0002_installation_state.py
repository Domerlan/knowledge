"""add installation state

Revision ID: 0002_installation_state
Revises: 0001_create_tables
Create Date: 2024-12-23 14:10:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_installation_state"
down_revision = "0001_create_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "installation_state",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("installed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("admin_user_id", sa.String(length=36), nullable=True),
        sa.Column("seed_applied", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["admin_user_id"], ["users.id"]),
    )


def downgrade() -> None:
    op.drop_table("installation_state")
