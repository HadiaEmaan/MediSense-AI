
import os
import sys
import argparse

# --------------------------------------------------
# 1. Add project root to Python path
# --------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# --------------------------------------------------
# 2. Load environment variables
# --------------------------------------------------
from dotenv import load_dotenv

load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

# --------------------------------------------------
# 3. Import Flask application and database
# --------------------------------------------------
from backend.app import create_app
from backend.app.extensions import db

from backend.app.models import (
    User,
    DoctorSchedule,
    Appointment,
    DiagnosticScan,
    AuditLog,
    EncounterNote,
    VitalReading,
    Prescription,
)

# --------------------------------------------------
# 4. Create application at module level
#    Required for Gunicorn: run:app
# --------------------------------------------------
app = create_app()


# --------------------------------------------------
# 5. Main function for local development
# --------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="MediSense AI Flask server"
    )

    parser.add_argument(
        "--init-db",
        action="store_true",
        help="Create all database tables",
    )

    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind",
    )

    parser.add_argument(
        "--port",
        type=int,
        default=5000,
        help="Port to bind",
    )

    args = parser.parse_args()

    # Initialize database tables if requested
    if args.init_db:
        with app.app_context():
            db.create_all()

        print("Database initialized successfully.")
        return

    # Start Flask development server
    app.run(
        host=args.host,
        port=args.port,
        debug=True,
        use_reloader=False,
    )


# --------------------------------------------------
# 6. Run directly when executing python run.py
# --------------------------------------------------
if __name__ == "__main__":
    main()
