curl https://next-backend-notif.qa1.ue1.oke.gettr-qa.com/api/v1/fast-user \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
  "user_id": "labin",
  "options": {
    "post": true,
    "build_cache": true
  }
}'