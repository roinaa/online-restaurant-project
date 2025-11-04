from django.db import models
from django.utils.text import slugify
from django.contrib.auth.models import User


User._meta.get_field('email')._unique = True
User._meta.get_field('email').blank = False
User._meta.get_field('email').null = False

class DishCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
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

    is_featured = models.BooleanField(default=False)  # ჩამრთველი რჩეული კერძებისთვის

    def __str__(self):
        return self.name

    @property
    def average_rating(self):
        from django.db.models import Avg
        rating = self.reviews.aggregate(Avg('rating'))['rating__avg']
        if rating:
            return round(rating, 1)
        return 0

    @property
    def review_count(self):
        return self.reviews.count()

class UserProfile(models.Model):
    # OneToOneField ნიშნავს, რომ ერთ User-ს შეუძლია ჰქონდეს მხოლოდ ერთი UserProfile
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address_line_1 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending (Cart)'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    # კავშირი მომხმარებელთან
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return f"Order {self.id} by {self.user.username} ({self.status})"

    # ფუნქცია, რომელიც გადაითვლის კალათის/შეკვეთის ჯამურ ფასს
    def calculate_total(self):
        total = sum(item.get_total_price() for item in self.items.all())
        self.total_price = total
        self.save()
        return total

class OrderItem(models.Model):
    #მოდელი, რომელიც აღწერს კონკრეტულ კერძს კონკრეტულ შეკვეთაში.
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    dish = models.ForeignKey(Dish, on_delete=models.SET_NULL, null=True, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    price_at_order = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.dish.name if self.dish else 'Deleted Dish'} in Order {self.order.id}"

    # ფუნქცია ამ რიგის ჯამური ფასის გამოსათვლელად
    def get_total_price(self):
        return self.price_at_order * self.quantity
    # ფუნქცია, რომელიც ავტომატურად შეინახავს ფასს, როცა ობიექტი იქმნება
    def save(self, *args, **kwargs):
        if not self.pk:
             self.price_at_order = self.dish.price
        super().save(*args, **kwargs)

class Review(models.Model):

    # მოდელი კერძების შეფასებებისთვის.
    RATING_CHOICES = [
        (1, '1 - Poor'),
        (2, '2 - Fair'),
        (3, '3 - Good'),
        (4, '4 - Very Good'),
        (5, '5 - Excellent'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews') # ვინ დაწერა
    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name='reviews') # რომელი კერძი შეაფასა
    rating = models.IntegerField(choices=RATING_CHOICES) # შეფასება (1-5)
    comment = models.TextField(blank=True, null=True) # კომენტარი
    created_at = models.DateTimeField(auto_now_add=True) # დამატების დრო

    class Meta:
        # ვამატებთ შეზღუდვას: ერთ მომხმარებელს შეუძლია ერთი კერძი მხოლოდ ერთხელ შეაფასოს
        unique_together = ('user', 'dish')

    def __str__(self):
        return f"Review for {self.dish.name} by {self.user.username} ({self.rating} stars)"



from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):

    if created:
        UserProfile.objects.create(user=instance)