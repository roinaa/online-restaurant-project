import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify
from django.core.files.base import ContentFile
from api.models import DishCategory, Dish
import os # დაგვჭირდება ფაილის სახელისთვის

CATEGORIES_API_URL = "https://restaurant.stepprojects.ge/api/Categories/GetAll"
DISHES_API_URL = "https://restaurant.stepprojects.ge/api/Products/GetAll"
IMAGE_BASE_URL = "https://restaurant.stepprojects.ge/"

class Command(BaseCommand):
    help = 'Populates the database with dishes and categories from the external API'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting database population...'))

        category_map = {}
        try:
            response = requests.get(CATEGORIES_API_URL)
            response.raise_for_status()
            categories_data = response.json()

            for cat_data in categories_data:
                category_name = cat_data.get('name')
                external_id = cat_data.get('id')
                if category_name and external_id is not None:
                    category_slug = slugify(category_name)
                    category, created = DishCategory.objects.get_or_create(
                        name=category_name,
                        defaults={'slug': category_slug}
                    )
                    category_map[external_id] = category
                    if created:
                        self.stdout.write(f'Created category: {category.name} (Mapped external ID: {external_id})')

        except requests.exceptions.RequestException as e:
            raise CommandError(f'Error fetching categories: {e}')
        except Exception as e:
            raise CommandError(f'An error occurred processing categories: {e}')

        self.stdout.write(self.style.SUCCESS(f'Categories processed. Map created with {len(category_map)} entries.'))
        if not category_map:
            self.stdout.write(self.style.WARNING('Category map is empty. Cannot proceed with dishes.'))
            return

        try:
            response = requests.get(DISHES_API_URL)
            response.raise_for_status()
            dishes_data = response.json()

            for dish_data in dishes_data:
                dish_name = dish_data.get('name')
                external_category_id = dish_data.get('categoryId')

                if dish_name and not Dish.objects.filter(name=dish_name).exists():

                    local_category = category_map.get(external_category_id)

                    if local_category:
                        try:
                            dish = Dish.objects.create(
                                category=local_category,
                                name=dish_name,
                                price=dish_data.get('price', 0.00),
                                spiciness=dish_data.get('spiciness', 0),
                                has_nuts=dish_data.get('nuts', False),
                                is_vegetarian=dish_data.get('vegetarian', False),
                                description=dish_data.get('description', '')
                            )

                            image_url_path = dish_data.get('image')
                            if image_url_path:
                                if image_url_path.startswith('http://') or image_url_path.startswith('https://'):
                                    image_full_url = image_url_path
                                elif image_url_path.startswith('/'):
                                    image_full_url = IMAGE_BASE_URL + image_url_path.lstrip('/')
                                else:
                                    image_full_url = IMAGE_BASE_URL + image_url_path

                                try:
                                    self.stdout.write(
                                        f"Attempting to download image from: {image_full_url}")
                                    img_response = requests.get(image_full_url, stream=True,
                                                                timeout=10)
                                    img_response.raise_for_status()

                                    file_name = os.path.basename(image_url_path)
                                    file_name = "".join(c for c in file_name if c.isalnum() or c in ['.', '_']).rstrip()
                                    if not file_name:
                                        file_name = f"dish_{dish.id}_image.jpg"

                                    dish.image.save(file_name, ContentFile(img_response.content), save=True)
                                    self.stdout.write(f'Created/Updated dish: {dish.name} with image.')

                                except requests.exceptions.Timeout:
                                    self.stdout.write(self.style.WARNING(
                                        f'Timeout while downloading image {image_full_url} for {dish.name}'))
                                except requests.exceptions.RequestException as img_e:
                                    self.stdout.write(self.style.WARNING(
                                        f'Could not download image {image_full_url} for {dish.name}: {img_e}'))
                                except Exception as img_e_gen:
                                    self.stdout.write(
                                        self.style.WARNING(f'Error saving image for {dish.name}: {img_e_gen}'))
                            else:
                                self.stdout.write(f'Created dish: {dish.name} (no image field in API data).')

                        except Exception as create_e:
                            self.stdout.write(self.style.ERROR(f'Error creating dish {dish_name}: {create_e}'))
                    else:
                        self.stdout.write(self.style.WARNING(f'Local category not found in map for external ID {external_category_id} (Dish: {dish_name}). Skipping.'))
                #else:
                #    if dish_name:
                #        self.stdout.write(f'Dish already exists: {dish_name}')


        except requests.exceptions.RequestException as e:
            raise CommandError(f'Error fetching dishes: {e}')
        except Exception as e:
            raise CommandError(f'An error occurred processing dishes: {e}')

        self.stdout.write(self.style.SUCCESS('Database population finished successfully!'))