import { addDays, subDays, subHours } from 'date-fns';
import type { AppDatabase, ChatThread, Listing, Message, NotificationItem, Review, UserProfile } from '../types';

const now = new Date();

export const mockUsers: UserProfile[] = [
  {
    id: 'user_aarav',
    phone: '+919811223344',
    full_name: 'Aarav Mehta',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    bio: 'Weekend declutterer. Mostly gadgets and furniture from Koramangala.',
    location_lat: 12.9352,
    location_lng: 77.6245,
    locality: 'Koramangala',
    city: 'Bengaluru',
    is_verified: true,
    is_dealer: false,
    rating: 4.8,
    total_reviews: 29,
    listings_sold: 18,
    joined_at: subDays(now, 420).toISOString(),
    last_seen: subHours(now, 1).toISOString(),
    blocked_user_ids: [],
  },
  {
    id: 'user_isha',
    phone: '+919900112233',
    full_name: 'Isha Rao',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    bio: 'Interior stylist selling decor, plants and apartment essentials.',
    location_lat: 19.1136,
    location_lng: 72.8697,
    locality: 'Andheri West',
    city: 'Mumbai',
    is_verified: true,
    is_dealer: true,
    rating: 4.9,
    total_reviews: 57,
    listings_sold: 42,
    joined_at: subDays(now, 780).toISOString(),
    last_seen: subHours(now, 3).toISOString(),
    blocked_user_ids: [],
  },
  {
    id: 'user_kabir',
    phone: '+919701234567',
    full_name: 'Kabir Malhotra',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    bio: 'Cyclist, photographer, and collector of interesting things in Hauz Khas.',
    location_lat: 28.5494,
    location_lng: 77.2001,
    locality: 'Hauz Khas',
    city: 'Delhi',
    is_verified: true,
    is_dealer: false,
    rating: 4.6,
    total_reviews: 21,
    listings_sold: 13,
    joined_at: subDays(now, 650).toISOString(),
    last_seen: subHours(now, 5).toISOString(),
    blocked_user_ids: [],
  },
  {
    id: 'user_saanvi',
    phone: '+918888000111',
    full_name: 'Saanvi Reddy',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    bio: 'Student seller. Fast replies. Mostly books, electronics and hostel finds.',
    location_lat: 17.4375,
    location_lng: 78.4483,
    locality: 'Jubilee Hills',
    city: 'Hyderabad',
    is_verified: true,
    is_dealer: false,
    rating: 4.7,
    total_reviews: 17,
    listings_sold: 10,
    joined_at: subDays(now, 260).toISOString(),
    last_seen: subHours(now, 2).toISOString(),
    blocked_user_ids: [],
  },
  {
    id: 'user_vikram',
    phone: '+917700009999',
    full_name: 'Vikram Narayan',
    avatar_url: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=80',
    bio: 'IT professional in Pune. Clean tech, gaming and home office setup deals.',
    location_lat: 18.559,
    location_lng: 73.7868,
    locality: 'Baner',
    city: 'Pune',
    is_verified: true,
    is_dealer: false,
    rating: 4.5,
    total_reviews: 12,
    listings_sold: 7,
    joined_at: subDays(now, 340).toISOString(),
    last_seen: subHours(now, 7).toISOString(),
    blocked_user_ids: [],
  },
];

const listingSeed: Array<Omit<Listing, 'id' | 'created_at' | 'expires_at'>> = [
  { seller_id: 'user_aarav', title: 'iPhone 14 128GB Midnight', description: 'Purchased from Apple BKC, battery health 92%, with box and Spigen case.', price: 45900, is_negotiable: true, is_free: false, category: 'Mobiles', condition: 'Like New', images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1603921326210-6edd2d60ca68?auto=format&fit=crop&w=900&q=80'], location_lat: 12.934, location_lng: 77.626, locality: 'Koramangala', city: 'Bengaluru', status: 'active', views: 142, is_urgent: false, is_featured: true },
  { seller_id: 'user_aarav', title: 'IKEA Linnmon Study Table 120cm', description: 'Perfect for WFH. Minor scratch on one edge, sturdy and easy pickup from 5th Block.', price: 3200, is_negotiable: true, is_free: false, category: 'Furniture', condition: 'Good', images: ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80'], location_lat: 12.9331, location_lng: 77.6221, locality: 'Koramangala', city: 'Bengaluru', status: 'active', views: 88, is_urgent: true, is_featured: false },
  { seller_id: 'user_aarav', title: 'Sony WH-1000XM4 Headphones', description: 'Great ANC. Used mostly indoors. Includes carrying case and original cable.', price: 14999, is_negotiable: true, is_free: false, category: 'Electronics', condition: 'Like New', images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80'], location_lat: 12.9362, location_lng: 77.6205, locality: 'HSR Layout', city: 'Bengaluru', status: 'active', views: 233, is_urgent: false, is_featured: true },
  { seller_id: 'user_aarav', title: 'Royal Enfield Helmet Matte Black', description: 'ISI certified full-face helmet, size M, cleaned and ready.', price: 1800, is_negotiable: false, is_free: false, category: 'Bikes', condition: 'Good', images: ['https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=900&q=80'], location_lat: 12.928, location_lng: 77.61, locality: 'BTM Layout', city: 'Bengaluru', status: 'active', views: 31, is_urgent: true, is_featured: false },
  { seller_id: 'user_aarav', title: 'Bean Bag XL Grey', description: 'Soft refill added last month. Ideal for gaming setup or balcony corner.', price: 1200, is_negotiable: true, is_free: false, category: 'Home Decor', condition: 'Good', images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'], location_lat: 12.941, location_lng: 77.615, locality: 'Indiranagar', city: 'Bengaluru', status: 'active', views: 27, is_urgent: false, is_featured: false },

  { seller_id: 'user_isha', title: 'Marshall Emberton Bluetooth Speaker', description: 'Used in my studio. Rich bass, no dents, comes with braided cable.', price: 7999, is_negotiable: true, is_free: false, category: 'Electronics', condition: 'Like New', images: ['https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=900&q=80'], location_lat: 19.1211, location_lng: 72.8362, locality: 'Bandra West', city: 'Mumbai', status: 'active', views: 74, is_urgent: false, is_featured: true },
  { seller_id: 'user_isha', title: 'Velvet 3-Seater Sofa Olive Green', description: 'Statement sofa from Pepperfry, recently steam cleaned, pickup only.', price: 18500, is_negotiable: true, is_free: false, category: 'Furniture', condition: 'Good', images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80'], location_lat: 19.1345, location_lng: 72.8212, locality: 'Andheri West', city: 'Mumbai', status: 'active', views: 126, is_urgent: false, is_featured: true },
  { seller_id: 'user_isha', title: 'Set of 4 Ceramic Planters', description: 'Minimal cream finish. Great for balcony herbs or indoor snake plants.', price: 900, is_negotiable: false, is_free: false, category: 'Home Decor', condition: 'New', images: ['https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=80'], location_lat: 19.1173, location_lng: 72.8465, locality: 'Versova', city: 'Mumbai', status: 'active', views: 45, is_urgent: true, is_featured: false },
  { seller_id: 'user_isha', title: 'Samsung 253L Double Door Fridge', description: 'Cooling is excellent. Selling because I am upgrading my kitchen setup.', price: 13900, is_negotiable: true, is_free: false, category: 'Appliances', condition: 'Good', images: ['https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=900&q=80'], location_lat: 19.1113, location_lng: 72.8479, locality: 'Andheri West', city: 'Mumbai', status: 'reserved', views: 164, is_urgent: false, is_featured: false },
  { seller_id: 'user_isha', title: 'Dyson Airwrap Attachments Organiser', description: 'Custom acrylic organiser, barely used, fits all attachments perfectly.', price: 2500, is_negotiable: false, is_free: false, category: 'Fashion', condition: 'Like New', images: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80'], location_lat: 19.1155, location_lng: 72.8382, locality: 'Juhu', city: 'Mumbai', status: 'active', views: 61, is_urgent: false, is_featured: false },

  { seller_id: 'user_kabir', title: 'Canon EOS 200D II with 50mm Lens', description: 'Perfect beginner DSLR combo, shutter count low, includes 2 batteries.', price: 35500, is_negotiable: true, is_free: false, category: 'Electronics', condition: 'Like New', images: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80'], location_lat: 28.5521, location_lng: 77.2022, locality: 'Hauz Khas', city: 'Delhi', status: 'active', views: 109, is_urgent: false, is_featured: true },
  { seller_id: 'user_kabir', title: 'Firefox Rapide 21-Speed Cycle', description: 'Recently serviced, tyres changed in March, ideal for morning rides.', price: 7800, is_negotiable: true, is_free: false, category: 'Sports', condition: 'Good', images: ['https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=900&q=80'], location_lat: 28.5602, location_lng: 77.1944, locality: 'Green Park', city: 'Delhi', status: 'active', views: 92, is_urgent: false, is_featured: false },
  { seller_id: 'user_kabir', title: 'OnePlus 12R 256GB Cool Blue', description: 'Purchased 4 months ago, still under warranty, invoice available.', price: 31999, is_negotiable: false, is_free: false, category: 'Mobiles', condition: 'Like New', images: ['https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=900&q=80'], location_lat: 28.5477, location_lng: 77.2071, locality: 'Hauz Khas', city: 'Delhi', status: 'active', views: 58, is_urgent: true, is_featured: false },
  { seller_id: 'user_kabir', title: 'Mid-century Walnut Bookshelf', description: 'Solid wood bookshelf with 5 shelves. Fits studio apartments perfectly.', price: 6900, is_negotiable: true, is_free: false, category: 'Furniture', condition: 'Good', images: ['https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=900&q=80'], location_lat: 28.5662, location_lng: 77.2144, locality: 'Saket', city: 'Delhi', status: 'active', views: 38, is_urgent: false, is_featured: false },
  { seller_id: 'user_kabir', title: 'Free UPS Battery Backup Cabinet', description: 'Needs pickup today. Metal cabinet is sturdy, battery inside is dead.', price: 0, is_negotiable: false, is_free: true, category: 'Appliances', condition: 'Fair', images: ['https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=900&q=80'], location_lat: 28.5609, location_lng: 77.1986, locality: 'Malviya Nagar', city: 'Delhi', status: 'active', views: 17, is_urgent: true, is_featured: false },

  { seller_id: 'user_saanvi', title: 'Dell 24-inch Monitor P2419H', description: 'Works flawlessly. Great for coding and movies. HDMI cable included.', price: 7900, is_negotiable: true, is_free: false, category: 'Electronics', condition: 'Good', images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80'], location_lat: 17.4301, location_lng: 78.4371, locality: 'Jubilee Hills', city: 'Hyderabad', status: 'active', views: 67, is_urgent: false, is_featured: true },
  { seller_id: 'user_saanvi', title: 'Hostel Essentials Combo', description: 'Laundry basket, mini rack, two buckets and mirror. Selling as bundle.', price: 1100, is_negotiable: false, is_free: false, category: 'Home Decor', condition: 'Good', images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'], location_lat: 17.4382, location_lng: 78.4411, locality: 'Madhapur', city: 'Hyderabad', status: 'active', views: 23, is_urgent: true, is_featured: false },
  { seller_id: 'user_saanvi', title: 'Kindle Paperwhite 11th Gen', description: 'No scratches. Ideal for UPSC prep or leisure reading. Cover included.', price: 9200, is_negotiable: true, is_free: false, category: 'Books', condition: 'Like New', images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80'], location_lat: 17.4448, location_lng: 78.3927, locality: 'Gachibowli', city: 'Hyderabad', status: 'active', views: 52, is_urgent: false, is_featured: false },
  { seller_id: 'user_saanvi', title: 'Prestige Induction Cooktop', description: 'Single touch controls, perfect for PGs and hostels. Bill available.', price: 1700, is_negotiable: false, is_free: false, category: 'Appliances', condition: 'Good', images: ['https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=900&q=80'], location_lat: 17.4509, location_lng: 78.3837, locality: 'Financial District', city: 'Hyderabad', status: 'active', views: 29, is_urgent: false, is_featured: false },
  { seller_id: 'user_saanvi', title: 'Zara Denim Jacket Oversized M', description: 'Trendy wash, only worn twice, super clean. Pickup or Dunzo within 3 km.', price: 1600, is_negotiable: true, is_free: false, category: 'Fashion', condition: 'Like New', images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=80'], location_lat: 17.4399, location_lng: 78.4005, locality: 'Kondapur', city: 'Hyderabad', status: 'active', views: 41, is_urgent: false, is_featured: false },

  { seller_id: 'user_vikram', title: 'PS5 Disc Edition + 2 Controllers', description: 'Excellent condition, very light use, one extra Cosmic Red controller included.', price: 40999, is_negotiable: true, is_free: false, category: 'Gaming', condition: 'Like New', images: ['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=900&q=80'], location_lat: 18.5601, location_lng: 73.7812, locality: 'Baner', city: 'Pune', status: 'active', views: 144, is_urgent: false, is_featured: true },
  { seller_id: 'user_vikram', title: 'Ergonomic Mesh Office Chair', description: 'Lumbar support, smooth wheels, ideal for long desk sessions.', price: 4800, is_negotiable: true, is_free: false, category: 'Furniture', condition: 'Good', images: ['https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&w=900&q=80'], location_lat: 18.5672, location_lng: 73.7741, locality: 'Aundh', city: 'Pune', status: 'active', views: 66, is_urgent: true, is_featured: false },
  { seller_id: 'user_vikram', title: 'Nintendo Switch OLED', description: 'Comes with carrying case and Mario Kart 8 Deluxe cartridge.', price: 22900, is_negotiable: false, is_free: false, category: 'Gaming', condition: 'Like New', images: ['https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&w=900&q=80'], location_lat: 18.5423, location_lng: 73.7921, locality: 'Balewadi', city: 'Pune', status: 'active', views: 54, is_urgent: false, is_featured: false },
  { seller_id: 'user_vikram', title: 'Bosch Front Load Washing Machine 7kg', description: 'Fully working, moved to furnished flat so selling quickly.', price: 12500, is_negotiable: true, is_free: false, category: 'Appliances', condition: 'Good', images: ['https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=900&q=80'], location_lat: 18.5481, location_lng: 73.8071, locality: 'Wakad', city: 'Pune', status: 'active', views: 70, is_urgent: true, is_featured: false },
  { seller_id: 'user_vikram', title: 'MacBook Air M1 8GB 256GB', description: 'Battery health 96%, kept in sleeve always, invoice + charger available.', price: 51500, is_negotiable: true, is_free: false, category: 'Electronics', condition: 'Like New', images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80'], location_lat: 18.5513, location_lng: 73.7761, locality: 'Baner', city: 'Pune', status: 'active', views: 173, is_urgent: false, is_featured: true },

  { seller_id: 'user_isha', title: 'Air Fryer Philips 4.1L', description: 'Crispy snacks without oil. Great for apartments. Includes recipe booklet.', price: 5400, is_negotiable: true, is_free: false, category: 'Appliances', condition: 'Good', images: ['https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80'], location_lat: 13.0486, location_lng: 80.209, locality: 'T Nagar', city: 'Chennai', status: 'active', views: 26, is_urgent: false, is_featured: false },
  { seller_id: 'user_kabir', title: 'Yamaha Acoustic Guitar F280', description: 'Warm sound, fresh strings, includes capo and padded bag.', price: 6200, is_negotiable: true, is_free: false, category: 'Sports', condition: 'Good', images: ['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=900&q=80'], location_lat: 13.0399, location_lng: 80.2342, locality: 'Nungambakkam', city: 'Chennai', status: 'active', views: 33, is_urgent: false, is_featured: false },
  { seller_id: 'user_saanvi', title: 'Temple Brass Lamp Pair', description: 'Traditional kuthu vilakku set, polished and beautiful for festive decor.', price: 2900, is_negotiable: false, is_free: false, category: 'Home Decor', condition: 'Like New', images: ['https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80'], location_lat: 13.0604, location_lng: 80.2496, locality: 'Mylapore', city: 'Chennai', status: 'active', views: 19, is_urgent: false, is_featured: false },
  { seller_id: 'user_vikram', title: 'Voltas 1.5 Ton Inverter AC', description: 'Cooling is strong. Service done last month. Selling before move-out.', price: 21900, is_negotiable: true, is_free: false, category: 'Appliances', condition: 'Good', images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80'], location_lat: 19.0646, location_lng: 72.837, locality: 'Powai', city: 'Mumbai', status: 'active', views: 91, is_urgent: true, is_featured: false },
  { seller_id: 'user_aarav', title: 'Hero Pleasure Plus Scooter 2021', description: 'Single owner, insurance valid, city mileage around 45. RC transfer mandatory.', price: 46500, is_negotiable: true, is_free: false, category: 'Bikes', condition: 'Good', images: ['https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80'], location_lat: 12.9716, location_lng: 77.5946, locality: 'Richmond Town', city: 'Bengaluru', status: 'active', views: 65, is_urgent: false, is_featured: false },
  { seller_id: 'user_isha', title: 'Free Cardboard Moving Boxes (12)', description: 'Strong cartons from recent house move. Free if picked up today.', price: 0, is_negotiable: false, is_free: true, category: 'Home Decor', condition: 'Fair', images: ['https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80'], location_lat: 19.1251, location_lng: 72.8467, locality: 'Lokhandwala', city: 'Mumbai', status: 'active', views: 16, is_urgent: true, is_featured: false },
  { seller_id: 'user_kabir', title: 'Wooden Coffee Table Round', description: 'Compact coffee table for living room or studio apartment.', price: 2500, is_negotiable: true, is_free: false, category: 'Furniture', condition: 'Good', images: ['https://images.unsplash.com/photo-1499933374294-4584851497cc?auto=format&fit=crop&w=900&q=80'], location_lat: 28.5355, location_lng: 77.242, locality: 'Greater Kailash', city: 'Delhi', status: 'active', views: 47, is_urgent: false, is_featured: false },
  { seller_id: 'user_saanvi', title: 'Realme Buds Air 5 Pro', description: 'ANC works well, low-latency mode for gaming, includes extra ear tips.', price: 3700, is_negotiable: true, is_free: false, category: 'Electronics', condition: 'Like New', images: ['https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=900&q=80'], location_lat: 17.4474, location_lng: 78.3762, locality: 'Gachibowli', city: 'Hyderabad', status: 'active', views: 37, is_urgent: false, is_featured: false },
  { seller_id: 'user_vikram', title: 'Mi Purifier 3C', description: 'Used in bedroom, HEPA filter recently changed, very clean unit.', price: 6200, is_negotiable: true, is_free: false, category: 'Appliances', condition: 'Good', images: ['https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=900&q=80'], location_lat: 18.5311, location_lng: 73.8478, locality: 'Kothrud', city: 'Pune', status: 'active', views: 28, is_urgent: false, is_featured: false },
  { seller_id: 'user_aarav', title: 'CA Foundation Books 2025 Set', description: 'Latest modules with only a few pages highlighted. Great for fresh prep.', price: 850, is_negotiable: false, is_free: false, category: 'Books', condition: 'Good', images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80'], location_lat: 12.9698, location_lng: 77.7499, locality: 'Whitefield', city: 'Bengaluru', status: 'active', views: 22, is_urgent: false, is_featured: false },
  { seller_id: 'user_kabir', title: 'Amazon Echo Dot 5th Gen', description: 'Voice assistant speaker, perfect working condition, adapter included.', price: 2600, is_negotiable: true, is_free: false, category: 'Electronics', condition: 'Like New', images: ['https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=900&q=80'], location_lat: 28.5744, location_lng: 77.1885, locality: 'Vasant Vihar', city: 'Delhi', status: 'active', views: 42, is_urgent: false, is_featured: false },
  { seller_id: 'user_saanvi', title: 'Decathlon Yoga Mat 8mm', description: 'Barely used. Non-slip and easy to carry for classes.', price: 600, is_negotiable: false, is_free: false, category: 'Sports', condition: 'Like New', images: ['https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80'], location_lat: 17.4501, location_lng: 78.3852, locality: 'Kondapur', city: 'Hyderabad', status: 'active', views: 12, is_urgent: false, is_featured: false },
];

export const mockListings: Listing[] = listingSeed.map((item, index) => ({
  ...item,
  id: `listing_${index + 1}`,
  created_at: subHours(now, index * 3 + 1).toISOString(),
  expires_at: addDays(now, 60 - index).toISOString(),
}));

export const mockReviews: Review[] = [
  { id: 'review_1', reviewer_id: 'user_isha', reviewed_id: 'user_aarav', listing_id: 'listing_2', rating: 5, comment: 'Quick pickup and exactly as described.', created_at: subDays(now, 8).toISOString() },
  { id: 'review_2', reviewer_id: 'user_kabir', reviewed_id: 'user_isha', listing_id: 'listing_7', rating: 5, comment: 'Very responsive seller, smooth deal.', created_at: subDays(now, 14).toISOString() },
  { id: 'review_3', reviewer_id: 'user_vikram', reviewed_id: 'user_saanvi', listing_id: 'listing_18', rating: 4, comment: 'Product worked great, polite meetup.', created_at: subDays(now, 21).toISOString() },
];

export const mockChats: ChatThread[] = [
  { id: 'chat_1', listing_id: 'listing_2', buyer_id: 'user_saanvi', seller_id: 'user_aarav', last_message: 'Can you do ₹3000 if I pick up tonight?', last_message_at: subHours(now, 2).toISOString(), buyer_unread: 0, seller_unread: 1, status: 'active', typing_user_id: null },
  { id: 'chat_2', listing_id: 'listing_11', buyer_id: 'user_vikram', seller_id: 'user_kabir', last_message: 'Offer accepted. I can come tomorrow morning.', last_message_at: subHours(now, 6).toISOString(), buyer_unread: 0, seller_unread: 0, status: 'active', typing_user_id: null },
  { id: 'chat_3', listing_id: 'listing_21', buyer_id: 'user_aarav', seller_id: 'user_vikram', last_message: 'Still available? Is the red controller included?', last_message_at: subHours(now, 12).toISOString(), buyer_unread: 1, seller_unread: 0, status: 'active', typing_user_id: null },
];

export const mockMessages: Message[] = [
  { id: 'message_1', chat_id: 'chat_1', sender_id: 'user_saanvi', content: 'Hey Aarav, is the table still available?', type: 'text', is_read: true, created_at: subHours(now, 3).toISOString() },
  { id: 'message_2', chat_id: 'chat_1', sender_id: 'user_aarav', content: 'Yes, it is. Pickup from Koramangala 5th Block.', type: 'text', is_read: true, created_at: subHours(now, 2.8).toISOString() },
  { id: 'message_3', chat_id: 'chat_1', sender_id: 'user_saanvi', content: 'Can you do ₹3000 if I pick up tonight?', type: 'offer', offer_amount: 3000, offer_status: 'pending', is_read: false, created_at: subHours(now, 2).toISOString() },

  { id: 'message_4', chat_id: 'chat_2', sender_id: 'user_vikram', content: 'Loved the camera sample shots. Sending an offer.', type: 'text', is_read: true, created_at: subHours(now, 8).toISOString() },
  { id: 'message_5', chat_id: 'chat_2', sender_id: 'user_vikram', content: 'Offer', type: 'offer', offer_amount: 34000, offer_status: 'accepted', is_read: true, created_at: subHours(now, 7.5).toISOString() },
  { id: 'message_6', chat_id: 'chat_2', sender_id: 'user_kabir', content: 'Offer accepted. I can hold it till tomorrow morning.', type: 'system', is_read: true, created_at: subHours(now, 6).toISOString() },

  { id: 'message_7', chat_id: 'chat_3', sender_id: 'user_aarav', content: 'Still available? Is the red controller included?', type: 'text', is_read: false, created_at: subHours(now, 12).toISOString() },
];

export const mockNotifications: NotificationItem[] = [
  { id: 'notif_1', user_id: 'user_aarav', type: 'new_message', title: 'New message from Saanvi', body: 'Can you do ₹3000 if I pick up tonight?', data: { chatId: 'chat_1' }, is_read: false, created_at: subHours(now, 2).toISOString() },
  { id: 'notif_2', user_id: 'user_kabir', type: 'offer_accepted', title: 'Offer accepted', body: 'Vikram accepted your Canon EOS listing.', data: { chatId: 'chat_2' }, is_read: true, created_at: subHours(now, 6).toISOString() },
  { id: 'notif_3', user_id: 'user_vikram', type: 'price_drop', title: 'Saved item dropped in price', body: 'Marshall Emberton is now ₹7,999.', data: { listingId: 'listing_6' }, is_read: false, created_at: subHours(now, 10).toISOString() },
];

export const initialMockDb: AppDatabase = {
  users: mockUsers,
  listings: mockListings,
  chats: mockChats,
  messages: mockMessages,
  reviews: mockReviews,
  saved_listings: [{ id: 'saved_1', user_id: 'user_aarav', listing_id: 'listing_6', created_at: subDays(now, 2).toISOString() }],
  notifications: mockNotifications,
  reports: [],
  session: null,
  recent_searches: ['iPhone 14', 'Study table', 'Office chair'],
};
