curl --request POST \
  --url https://next-backend-notif.qa1.ue1.oke.gettr-qa.com/api/v1/fast-user \
  --header 'content-type: application/json' \
  --data '{
  "user_id": "live_wenxia",
  "options": {
    "build_cache": true
  }
 }