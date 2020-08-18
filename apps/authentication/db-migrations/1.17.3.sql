\set ON_ERROR_STOP true

-- Thanks to http://blog.bguiz.com/2017/json-merge-postgresql/
CREATE OR REPLACE FUNCTION JSONB_MERGE_RECURSE(orig JSONB, delta JSONB)
  RETURNS JSONB
  LANGUAGE SQL AS
$$
SELECT JSONB_OBJECT_AGG(
    coalesce(keyOrig, keyDelta),
    CASE
      WHEN valOrig ISNULL
        THEN valDelta
      WHEN valDelta ISNULL
        THEN valOrig
      WHEN (JSONB_TYPEOF(valOrig) <> 'object' OR JSONB_TYPEOF(valDelta) <> 'object')
        THEN valDelta
      ELSE JSONB_MERGE_RECURSE(valOrig, valDelta)
      END
  )
  FROM JSONB_EACH(orig) e1(keyOrig, valOrig)
         FULL JOIN JSONB_EACH(delta) e2(keyDelta, valDelta) ON keyOrig = keyDelta
$$;

-- Default emailClaim to `email` for OpenID Connect Identity Providers
UPDATE identity_providers
SET data = JSONB_MERGE_RECURSE(COALESCE(data, '{}')::JSONB,
                               JSONB_BUILD_OBJECT('oauth2',
                                                  JSONB_STRIP_NULLS(
                                                      JSONB_BUILD_OBJECT(
                                                          'emailClaim', 'email'
                                                        ))))
  WHERE type = 'OpenIDConnect';

-- Update the version
UPDATE version
SET version = '1.17.3';