#!/bin/zsh
curl -X POST "https://accounts.zoho.com/oauth/v2/token" -H "Content-Type: application/x-www-form-urlencoded" -d "refresh_token=1000.09927923f937dbad37c23ebbc1c6ef8f.34f2ec85257c228d650942b29f6c0586" -d "client_id=1000.4CGA7VNQFWP8DOQM1A1MUU2T0M42PW" -d "client_secret=3acad3faae6a0cee51be94376d95c0d9a464092051" -d "grant_type=refresh_token" | python3 -m json.tool
