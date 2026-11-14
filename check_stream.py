import os
import requests

STREAMER_LOGIN = "dietotalechte"  # z.B. "papaplatte"
STATE_FILE = "last_stream_id.txt"

CLIENT_ID = os.environ["TWITCH_CLIENT_ID"]
CLIENT_SECRET = os.environ["TWITCH_CLIENT_SECRET"]
WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
ROLE_ID = os.environ["DISCORD_ROLE_ID"]

def get_twitch_token():
    res = requests.post(
        "https://id.twitch.tv/oauth2/token",
        params={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "client_credentials",
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()["access_token"]

def get_stream_info(token):
    res = requests.get(
        "https://api.twitch.tv/helix/streams",
        headers={
            "Client-ID": CLIENT_ID,
            "Authorization": f"Bearer {token}",
        },
        params={"user_login": STREAMER_LOGIN},
        timeout=10,
    )
    res.raise_for_status()
    data = res.json().get("data", [])
    return data[0] if data else None

def main():
    token = get_twitch_token()
    stream = get_stream_info(token)

    if not stream:
        print(f"{STREAMER_LOGIN} ist aktuell offline.")
        return

    stream_id = stream["id"]
    last_id = ""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            last_id = f.read().strip()

    if stream_id == last_id:
        print(f"Stream {stream_id} wurde bereits gemeldet.")
        return

    title = stream.get("title", "Live auf Twitch!")
    game = stream.get("game_name", "Just Chatting")
    url = f"https://www.twitch.tv/{STREAMER_LOGIN}"

    payload = {
        "content": f"<@&{ROLE_ID}> **{stream['user_name']}** ist jetzt live!",
        "embeds": [
            {
                "title": title,
                "url": url,
                "color": 9520895,
                "fields": [{"name": "Kategorie", "value": game, "inline": True}],
            }
        ],
    }

    webhook_res = requests.post(WEBHOOK_URL, json=payload, timeout=10)
    webhook_res.raise_for_status()

    with open(STATE_FILE, "w", encoding="utf-8") as f:
        f.write(stream_id)
    print(f"Ping gesendet für Stream {stream_id}.")

if __name__ == "__main__":
    main()
