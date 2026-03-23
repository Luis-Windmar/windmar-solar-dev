#!/bin/zsh
curl -X POST "https://accounts.zoho.com/oauth/v2/token" -H "Content-Type: application/x-www-form-urlencoded" -d "refresh_token=1000.2b8b2581fca30284a785e5a14dfe41e5.aefe5f98a0fb102072faabd170593bc8" -d "client_id=1000.JM0DSHJNUTC6BZ7US8F9L2VYPTDM6N" -d "client_secret=2585226ae1799280a3d520b683ba73046969ed2658" -d "grant_type=refresh_token" | python3 -m json.tool
