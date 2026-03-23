-- Create ENUM types for Tasko database schema
-- This migration creates all enum types used across tables

-- Project status enum: inProgress or done
CREATE TYPE project_status AS ENUM ('inProgress', 'done');

-- Task status enum: 5-stage workflow
CREATE TYPE task_status AS ENUM (
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_CONFIRM',
  'APPROVED',
  'REJECTED'
);

-- Message type enum: USER or SYSTEM
CREATE TYPE message_type AS ENUM ('USER', 'SYSTEM');

-- Add comments for documentation
COMMENT ON TYPE project_status IS 'Project status: inProgress (ongoing) or done (completed)';
COMMENT ON TYPE task_status IS 'Task workflow status: ASSIGNED -> IN_PROGRESS -> WAITING_CONFIRM -> APPROVED/REJECTED';
COMMENT ON TYPE message_type IS 'Message type: USER (user messages) or SYSTEM (automated system messages)';

