import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or update a default Django admin user."

    def handle(self, *args, **options):
        user_model = get_user_model()
        username = os.getenv("DJANGO_ADMIN_USERNAME", "admin")
        email = os.getenv("DJANGO_ADMIN_EMAIL", "admin@example.com")
        password = os.getenv("DJANGO_ADMIN_PASSWORD", "Admin@123")

        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        user.email = email
        user.is_staff = True
        user.is_superuser = True
        user.set_password(password)
        user.save()

        action = "created" if created else "updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"Admin user {action}: username={username} password={password}"
            )
        )
