"""
Gunicorn configuration file for HR Bot backend
"""
import multiprocessing
import os

# Server socket
bind = "127.0.0.1:8000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = "/var/log/hr_bot/gunicorn_access.log"
errorlog = "/var/log/hr_bot/gunicorn_error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "hr_bot_backend"

# Server mechanics
daemon = False
pidfile = "/var/run/hr_bot/gunicorn.pid"
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (if needed)
# keyfile = None
# certfile = None

# Preload app
preload_app = True

# Worker timeout
graceful_timeout = 30

# Max requests per worker (restart workers after this many requests)
max_requests = 1000
max_requests_jitter = 50

