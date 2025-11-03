from rest_framework import serializers
from .models import DishCategory, Dish, UserProfile, Order, OrderItem, Review
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token

class DishCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DishCategory
        fields = ['id', 'name', 'slug']

class DishSerializer(serializers.ModelSerializer):
    category = serializers.StringRelatedField()
    spiciness_display = serializers.CharField(source='get_spiciness_display', read_only=True)

    class Meta:
        model = Dish
        fields = ['id', 'category', 'name', 'image', 'price',
                  'spiciness', 'spiciness_display', 'has_nuts', 'is_vegetarian', 'description', 'average_rating', 'review_count']


# ახალი მომხმარებლის რეგისტრაციის სერიალიზატორი
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')
        extra_kwargs = {'password': {'write_only': True, 'required': True},
                        'email': {'required': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        # მომხმარებლის შექმნასთან ერთად, ავტომატურად ვუქმნით მას Token-ს
        Token.objects.create(user=user)
        return user

# ახალი ლოგინის სერიალიზატორი
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')

        if email and password:
            try:
                user_obj = User.objects.get(email=email)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None

            if user and user.is_active:
                data['user'] = user
                return data

        raise serializers.ValidationError("Incorrect Credentials. Please try again.")


class OrderItemSerializer(serializers.ModelSerializer):
    dish_name = serializers.CharField(source='dish.name', read_only=True)
    dish_image = serializers.ImageField(source='dish.image', read_only=True)
    dish_price = serializers.DecimalField(source='dish.price', max_digits=10, decimal_places=2, read_only=True)

    is_reviewed = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ('id', 'dish', 'dish_name', 'dish_image', 'dish_price', 'quantity', 'price_at_order', 'is_reviewed')
        read_only_fields = ('price_at_order',)

    def get_is_reviewed(self, obj):
        user = obj.order.user
        dish = obj.dish

        if not user or not dish:
            return False

        # ვამოწმებთ, არსებობს თუ არა Review მოდელში ასეთი ჩანაწერი
        return Review.objects.filter(user=user, dish=dish).exists()


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ('id', 'user', 'created_at', 'status', 'total_price', 'items')
        read_only_fields = ('user', 'total_price', 'created_at')


class UserProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    username = serializers.CharField(source='user.username')

    class Meta:
        model = UserProfile
        fields = ('username', 'email', 'phone_number', 'address_line_1', 'city')

    def update(self, instance, validated_data):
        # განვაახლოთ User მოდელი (username)
        # ამოვიღოთ 'user' მონაცემები validated_data-დან
        user_data = validated_data.pop('user', {})
        username = user_data.get('username')

        if username:
            # ვამოწმებთ, ხომ არ არის ეს username-ი უკვე დაკავებული
            if User.objects.filter(username=username).exclude(pk=instance.user.pk).exists():
                raise serializers.ValidationError({"username": "A user with that username already exists."})
            instance.user.username = username
            instance.user.save()

        # განვაახლოთ UserProfile მოდელი (phone, address, city)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.address_line_1 = validated_data.get('address_line_1', instance.address_line_1)
        instance.city = validated_data.get('city', instance.city)
        instance.save()

        return instance


# შეფასების დამატება
class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ('id', 'dish', 'rating', 'comment', 'created_at')
        read_only_fields = ('id', 'created_at',)
        extra_kwargs = {
            'dish': {'write_only': True},
            'rating': {'required': True},
        }

    def validate(self, data):
        data['user'] = self.context['request'].user

        # ვამოწმებთ unique_together შეზღუდვას
        if Review.objects.filter(user=data['user'], dish=data['dish']).exists():
            raise serializers.ValidationError("You have already reviewed this dish.")

        return data