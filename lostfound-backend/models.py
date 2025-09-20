# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    _tablename_ = "users"
    id = db.Column(db.Integer, primary_key=True)                     # unique user id
    username = db.Column(db.String(80), unique=True, nullable=False) # login name
    email = db.Column(db.String(200), unique=True, nullable=False)   # email
    password_hash = db.Column(db.String(200), nullable=False)        # bcrypt hash
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship("Item", back_populates="poster", cascade="all, delete-orphan")

class Item(db.Model):
    _tablename_ = "items"
    id = db.Column(db.Integer, primary_key=True)
    posted_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(10), nullable=False)  # 'lost' or 'found' (we validate in code)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    image_filename = db.Column(db.String(500))  # saved filename inside uploads/
    location = db.Column(db.String(200))
    posted_at = db.Column(db.DateTime, default=datetime.utcnow)
    finder_name = db.Column(db.String(200))
    finder_phone = db.Column(db.String(100))
    finder_email = db.Column(db.String(200))

    poster = db.relationship("User", back_populates="items")
