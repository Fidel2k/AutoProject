import hashlib, secrets

def password_hash(password):
    salt=secrets.token_hex(16)
    return salt+':'+hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
def verify(password, encoded):
    salt, hashed=encoded.split(':')
    return secrets.compare_digest(hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex(),hashed)
