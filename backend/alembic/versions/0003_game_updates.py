"""add game updates

Revision ID: 0003_game_updates
Revises: 0002_installation_state
Create Date: 2025-01-03 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_game_updates"
down_revision = "0002_installation_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "game_updates",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("patch_date", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "published", "archived", name="game_update_status", native_enum=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("updated_by_id", sa.String(length=36), nullable=True),
        sa.Column("published_by_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["published_by_id"], ["users.id"]),
    )
    op.create_index("ix_game_updates_patch_date", "game_updates", ["patch_date"], unique=False)
    op.create_index("ix_game_updates_status", "game_updates", ["status"], unique=False)
    op.create_index("ix_game_updates_deleted_at", "game_updates", ["deleted_at"], unique=False)
    op.create_index("ix_game_updates_created_by_id", "game_updates", ["created_by_id"], unique=False)

    op.create_table(
        "game_update_audits",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("update_id", sa.String(length=36), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["update_id"], ["game_updates.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
    )
    op.create_index("ix_game_update_audits_update_id", "game_update_audits", ["update_id"], unique=False)
    op.create_index("ix_game_update_audits_actor_id", "game_update_audits", ["actor_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_game_update_audits_actor_id", table_name="game_update_audits")
    op.drop_index("ix_game_update_audits_update_id", table_name="game_update_audits")
    op.drop_table("game_update_audits")

    op.drop_index("ix_game_updates_created_by_id", table_name="game_updates")
    op.drop_index("ix_game_updates_deleted_at", table_name="game_updates")
    op.drop_index("ix_game_updates_status", table_name="game_updates")
    op.drop_index("ix_game_updates_patch_date", table_name="game_updates")
    op.drop_table("game_updates")
