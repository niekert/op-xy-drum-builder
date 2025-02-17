-- Add directory column to samples table
ALTER TABLE samples 
ADD COLUMN IF NOT EXISTS directory TEXT NOT NULL DEFAULT '/';

-- Update existing rows to have the root directory
UPDATE samples 
SET directory = '/' 
WHERE directory IS NULL;

-- Add audio details columns to samples table
ALTER TABLE samples
ADD COLUMN IF NOT EXISTS channels INTEGER,
ADD COLUMN IF NOT EXISTS sample_rate INTEGER,
ADD COLUMN IF NOT EXISTS rms_level DOUBLE PRECISION;

-- Add device_id column to samples table
ALTER TABLE samples
ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT '';

-- Create drum_racks table
CREATE TABLE IF NOT EXISTS drum_racks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    configuration JSONB NOT NULL,
    device_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster name searches
CREATE INDEX IF NOT EXISTS drum_racks_name_idx ON drum_racks(name);

-- Add indexes for device_id lookups
CREATE INDEX IF NOT EXISTS samples_device_id_idx ON samples(device_id);
CREATE INDEX IF NOT EXISTS drum_racks_device_id_idx ON drum_racks(device_id); 