from django.db import models
from django.utils.text import slugify
from django.contrib.auth.models import User
from decimal import Decimal


User._meta.get_field('email')._unique = True
User._meta.get_field('email').blank = False
User._meta.get_field('email').null = False

# ეს მოდელი ინახავს ფასდაკლების კუპონებს.
class Coupon(models.Model):
    code = models.CharField(max_length=50, unique=True)
    discount_percent = models.PositiveIntegerField(
        help_text="Discount percentage (e.g., 10 for 10%)"
    )
    is_active = models.BooleanField(default=True)# კუპონის ჩამრთველი
    valid_from = models.DateTimeField(auto_now_add=True)
    valid_to = models.DateTimeField(
        null=True, blank=True,
        help_text="Leave blank for no expiration date"
    )
    # ერთმა მომხმარებელმა მხოლოდ ერთხელ გამოიყენოს აქტიური კუპონი
    one_use_per_user = models.BooleanField(
        default=True,
        help_text="If checked, a user can only use this coupon code once."
    )

    def __str__(self):
        return f"{self.code} ({self.discount_percent}%)"

# კერძების კატეგორიები
class DishCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

# მოდელი - კერძი
class Dish(models.Model):
    SPICINESS_CHOICES = [
        (0, 'Not Spicy'),
        (1, 'Mild'),
        (2, 'Medium'),
        (3, 'Hot'),
        (4, 'Very Hot'),
    ]
    # ერთი-ბევრთან კავშირი კატეგორიასთან
    category = models.ForeignKey(DishCategory, related_name='dishes', on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    image = models.ImageField(upload_to='dishes/', blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    # ფილტრაციის ველები
    spiciness = models.IntegerField(choices=SPICINESS_CHOICES, default=0)
    has_nuts = models.BooleanField(default=False)
    is_vegetarian = models.BooleanField(default=False)

    description = models.TextField(blank=True, null=True)
    is_featured = models.BooleanField(default=False)  # მთავარ გვერდზე რჩეული კერძების გამოსაჩენად

    def __str__(self):
        return self.name

    # გამოთვლადი ველები
    @property
    def average_rating(self):
        # ეს ითვლის ამ კერძის ყველა რევიუს საშუალოს
        from django.db.models import Avg
        rating = self.reviews.aggregate(Avg('rating'))['rating__avg']
        if rating:
            return round(rating, 1) # ვამრგვალებ
        return 0

    @property
    def review_count(self):
        # ითვლის, სულ რამდენი რევიუ აქვს ამ კერძს
        return self.reviews.count()

# მომხმარებლის პროფილი
class UserProfile(models.Model):
    # ეს არის ერთი-ერთთან კავშირი
    # ერთ User-ს შეუძლია ჰქონდეს მხოლოდ ერთი UserProfile
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address_line_1 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

# შეკვეთის მოდელი
class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending (Cart)'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    # ერთი-ბევრთან კავშირი
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    coupon = models.ForeignKey(Coupon, related_name='orders', on_delete=models.SET_NULL, null=True, blank=True )
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return f"Order {self.id} by {self.user.username} ({self.status})"

    # ეს ფუნქცია ითვლის კალათის/შეკვეთის ჯამურ ფასს
    def calculate_total(self):
        total = sum(item.get_total_price() for item in self.items.all())
        # მოწმდება აქვს თუ არა შეკვეთას მიბმული კუპონი
        if self.coupon and self.coupon.is_active:
            # ფასდაკლების დათვლა და გამოკლება
            discount_multiplier = Decimal(self.coupon.discount_percent) / Decimal(100)
            discount_amount = total * discount_multiplier
            total = total - discount_amount
        # ვამრგვალებ და ვინახავ ბაზაში
        self.total_price = round(total, 2)
        self.save()
        return total

# შეკვეთის ერთეულის მოდელი
class OrderItem(models.Model):
    # ეს მოდელი აკავშირებს Order-ს და Dish-ს (ბევრი-ბევრთან კავშირი)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    dish = models.ForeignKey(Dish, on_delete=models.SET_NULL, null=True, related_name='order_items')
    quantity = models.PositiveIntegerField(default=1)
    price_at_order = models.DecimalField(max_digits=10, decimal_places=2) # ეს ინახავს ფასს შეკვეთის მომენტში

    def __str__(self):
        return f"{self.quantity} x {self.dish.name if self.dish else 'Deleted Dish'} in Order {self.order.id}"

    def get_total_price(self):
        return self.price_at_order * self.quantity
    # ფუნქცია, რომელიც ავტომატურად შეინახავს ფასს, როცა ობიექტი იქმნება
    def save(self, *args, **kwargs):
        if not self.pk:
             self.price_at_order = self.dish.price
        super().save(*args, **kwargs)

# შეფასების მოდელი
class Review(models.Model):

    RATING_CHOICES = [
        (1, '1 - Poor'),
        (2, '2 - Fair'),
        (3, '3 - Good'),
        (4, '4 - Very Good'),
        (5, '5 - Excellent'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name='reviews')
    rating = models.IntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'dish')

    def __str__(self):
        return f"Review for {self.dish.name} by {self.user.username} ({self.rating} stars)"

# მაგიდის დაჯავშნის მოდელები

# 1. მაგიდის მოდელი
class Table(models.Model):

    name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField(
        help_text="რამდენი ადამიანი ეტევა მაქსიმუმ"
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} (Capacity: {self.capacity})"

    class Meta:
        ordering = ['capacity']

# 2. სამუშაო საათების მოდელი
class OperatingHours(models.Model):

    WEEKDAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    weekday = models.IntegerField(choices=WEEKDAY_CHOICES, unique=True)
    open_time = models.TimeField()
    close_time = models.TimeField()

    def __str__(self):
        return f"{self.get_weekday_display()}: {self.open_time.strftime('%H:%M')} - {self.close_time.strftime('%H:%M')}"

    class Meta:
        ordering = ['weekday']

# 3. ჯავშნის მოდელი
class Reservation(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Confirmed', 'Confirmed'),
        ('Cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reservations')
    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name='reservations')
    party_size = models.PositiveIntegerField(
        help_text="სტუმრების რაოდენობა"
    )
    # ზუსტი დრო და თარიღი
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Confirmed')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Reservation for {self.user.username} at {self.table.name} ({self.start_time.strftime('%Y-%m-%d %H:%M')})"

    class Meta:
        ordering = ['start_time']
