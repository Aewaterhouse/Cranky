import os
import tempfile

os.environ.setdefault("ZB_TIME_SCALE", "40")
os.environ.setdefault("ZB_DB", os.path.join(tempfile.mkdtemp(), "test.db"))
