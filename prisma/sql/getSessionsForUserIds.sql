SELECT sid, sess, expire
FROM sessions
WHERE (sess->'user'->>'id') = ANY($1)
