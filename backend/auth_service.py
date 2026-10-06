from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD


class AuthService:
    def __init__(self):
        self.username = ADMIN_USERNAME
        self.password = ADMIN_PASSWORD

    def login(self, username: str, password: str):
        if username == self.username and password == self.password:
            return {"token": "demo-admin-token", "user": username}
        raise PermissionError("Invalid username or password.")
