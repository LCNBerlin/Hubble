-- Hubble PostgreSQL functions

CREATE OR REPLACE FUNCTION get_nearby_post_ids(
  center_lat double precision,
  center_lng double precision,
  radius_km double precision,
  max_results integer DEFAULT 100
)
RETURNS TABLE(post_id uuid, distance_km double precision) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id,
    (6371 * acos(
      LEAST(1.0, cos(radians(center_lat)) * cos(radians(pr.lat::double precision)) *
      cos(radians(pr.lng::double precision) - radians(center_lng)) +
      sin(radians(center_lat)) * sin(radians(pr.lat::double precision)))
    )) AS distance_km
  FROM posts p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE pr.lat IS NOT NULL AND pr.lng IS NOT NULL
    AND (6371 * acos(
      LEAST(1.0, cos(radians(center_lat)) * cos(radians(pr.lat::double precision)) *
      cos(radians(pr.lng::double precision) - radians(center_lng)) +
      sin(radians(center_lat)) * sin(radians(pr.lat::double precision)))
    )) <= radius_km
  ORDER BY distance_km ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
