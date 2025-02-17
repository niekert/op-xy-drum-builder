-- Add directory column to samples table
ALTER TABLE samples 
ADD COLUMN IF NOT EXISTS directory TEXT NOT NULL DEFAULT '/';

-- Update existing rows to have the root directory
UPDATE samples 
SET directory = '/' 
WHERE directory IS NULL;

-- Create drum_racks table
CREATE TABLE IF NOT EXISTS drum_racks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    configuration JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster name searches
CREATE INDEX IF NOT EXISTS drum_racks_name_idx ON drum_racks(name); 