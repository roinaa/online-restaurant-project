from django.db import models


class DishCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Dish(models.Model):
    SPICINESS_CHOICES = [
        (0, 'Not Spicy'),
        (1, 'Mild'),
        (2, 'Medium'),
        (3, 'Hot'),
        (4, 'Very Hot'),
    ]

    category = models.ForeignKey(DishCategory, related_name='dishes', on_delete=models.CASCADE)  #
    name = models.CharField(max_length=200)  # [cite: 1333]
    image = models.ImageField(upload_to='dishes/', blank=True, null=True)  #
    price = models.DecimalField(max_digits=10, decimal_places=2)  # [cite: 1337]

    spiciness = models.IntegerField(choices=SPICINESS_CHOICES, default=0)  # [cite: 1327, 1334]
    has_nuts = models.BooleanField(default=False)  # [cite: 1328, 1335]
    is_vegetarian = models.BooleanField(default=False)  # [cite: 1329, 1336]

    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name