import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, addDoc, setDoc, query, where } from 'firebase/firestore';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { auth, db, firebaseConfigured } from '../firebase';

type Role = 'customer' | 'shopkeeper';
type Profile = { role: Role; name: string; shopName?: string; latitude?: number; longitude?: number; address?: string; };
type Product = { id: string; name: string; price: number; materials: string; description: string; sellerId: string; seller: string; dzongkhag: string; stock: number; };
type Shop = { id: string; name: string; latitude: number; longitude: number; address: string; };
const wine = '#8F3035';
function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && { opacity: .5 }]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}
function Field({ placeholder, value, onChangeText, secureTextEntry = false, keyboardType }: any) {
  return <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={keyboardType} style={styles.input} placeholderTextColor="#777" />;
}
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role>('customer');
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [tab, setTab] = useState<'products' | 'map' | 'sell' | 'bookings'>('products');
  const [productName, setProductName] = useState(''); const [materials, setMaterials] = useState(''); const [description, setDescription] = useState('');
  const [price, setPrice] = useState(''); const [stock, setStock] = useState(''); const [dzongkhag, setDzongkhag] = useState('');
  const [shopName, setShopName] = useState(''); const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!user) { setProfile(null); return; }
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setProfile(snap.data() as Profile);
    }, e => Alert.alert('Profile error', e.message));
  }, [user?.uid]);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ ...(d.data() as any), id: d.id })).filter(p => p.sellerId && p.sellerId !== 'demo'));
    }, e => Alert.alert('Products', e.message));
  }, [user?.uid]);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users'), snap => {
      setShops(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(s => s.role === 'shopkeeper' && typeof s.latitude === 'number' && typeof s.longitude === 'number').map(s => ({ id: s.id, name: s.shopName || s.name, latitude: s.latitude, longitude: s.longitude, address: s.address || '' })));
    }, e => Alert.alert('Shops', e.message));
  }, [user?.uid]);
  useEffect(() => {
    if (!user || !profile) return;
    const field = profile.role === 'shopkeeper' ? 'sellerId' : 'customerId';
    return onSnapshot(query(collection(db, 'bookings'), where(field, '==', user.uid)), snap => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, e => Alert.alert('Bookings', e.message));
  }, [user?.uid, profile?.role]);
  async function authenticate() {
    if (!firebaseConfigured) return Alert.alert('Setup required', 'Add your Firebase web app configuration to .env');
    setBusy(true);
    try {
      if (register) {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', credential.user.uid), { uid: credential.user.uid, name: name.trim(), email: email.trim(), role, phoneVerified: false, shopName: role === 'shopkeeper' ? shopName.trim() : '', address: role === 'shopkeeper' ? address.trim() : '', verificationStatus: role === 'shopkeeper' ? 'pending' : 'not_required' });
      } else {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        const snap = await getDoc(doc(db, 'users', credential.user.uid));
        if (!snap.exists() || snap.data().role !== role) { await signOut(auth); throw new Error('Account role does not match the selected role.'); }
      }
    } catch (e: any) { Alert.alert('Authentication', e.message); }
    finally { setBusy(false); }
  }
  async function locate() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return Alert.alert('Location permission', 'Location is optional. Enable it to show your position.');
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude });
  }
  async function saveShopLocation() {
    if (!user || profile?.role !== 'shopkeeper' || !location) return;
    try { await setDoc(doc(db, 'users', user.uid), { latitude: location.latitude, longitude: location.longitude, address, shopName }, { merge: true }); Alert.alert('Saved', 'Shop coordinates updated.'); }
    catch (e: any) { Alert.alert('Save error', e.message); }
  }
  async function addProduct() {
    if (!user || !profile || !productName.trim() || !materials.trim() || !Number.isFinite(Number(price)) || Number(price) <= 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) return Alert.alert('Check details', 'Enter a name, materials, valid price and non-negative stock.');
    try {
      await addDoc(collection(db, 'products'), { name: productName.trim(), materials: materials.trim(), description: description.trim(), price: Number(price), stock: Number(stock), sellerId: user.uid, seller: profile.shopName || profile.name, dzongkhag: dzongkhag.trim(), address: profile.address || '', rating: 0, discountPercent: 0, category: 'Handmade', imageUrl: '', createdAt: new Date() });
      setProductName(''); setMaterials(''); setDescription(''); setPrice(''); setStock(''); Alert.alert('Saved', 'Product added.');
    } catch (e: any) { Alert.alert('Save error', e.message); }
  }
  async function reserve(p: Product) {
    if (!user || !profile || profile.role !== 'customer') return;
    if (p.stock < 1) return Alert.alert('Unavailable', 'This product is out of stock.');
    Alert.alert('Reservation', 'The existing Project I booking transaction and security rules must be migrated before live reservations can be enabled.');
  }
  if (!firebaseConfigured) return <View style={styles.page}><Text style={styles.heading}>TshongLa 2.0</Text><Text>Firebase configuration is missing. Copy .env.example to .env and fill in the Firebase Web App credentials.</Text></View>;
  if (!user || !profile) return <ScrollView contentContainerStyle={styles.page}><Text style={styles.heading}>TshongLa 2.0</Text><Text style={styles.sub}>Bhutanese handmade marketplace</Text>{!user && <><View style={styles.row}><Button title="Customer" onPress={() => setRole('customer')} /><Button title="Shopkeeper" onPress={() => setRole('shopkeeper')} /></View><Text>Selected: {role}</Text>{register && <Field placeholder="Full name" value={name} onChangeText={setName} />}{register && role === 'shopkeeper' && <><Field placeholder="Shop name" value={shopName} onChangeText={setShopName}/><Field placeholder="Shop address" value={address} onChangeText={setAddress}/></>}<Field placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address"/><Field placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry/><Button title={busy ? 'Please wait…' : register ? 'Create account' : 'Log in'} onPress={authenticate} disabled={busy}/><Button title={register ? 'Already registered? Log in' : 'New user? Register'} onPress={() => setRegister(!register)}/></>}{user && <Text>Loading profile…</Text>}</ScrollView>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.heading}>TshongLa 2.0</Text><Text style={styles.sub}>Welcome, {profile.name} · {profile.role}</Text>
    <View style={styles.row}><Button title="Products" onPress={() => setTab('products')}/><Button title="Map" onPress={() => setTab('map')}/></View>
    <View style={styles.row}><Button title={profile.role === 'shopkeeper' ? 'My Shop' : 'Bookings'} onPress={() => setTab(profile.role === 'shopkeeper' ? 'sell' : 'bookings')}/><Button title="Sign out" onPress={() => signOut(auth)}/></View>
    {tab === 'products' && <><Text style={styles.section}>Handmade products</Text>{products.length === 0 && <Text>No products yet.</Text>}{products.map(p => <View style={styles.card} key={p.id}><Text style={styles.cardTitle}>{p.name}</Text><Text>Nu. {p.price} · Stock: {p.stock}</Text><Text>Shop: {p.seller} · {p.dzongkhag}</Text><Text>Raw materials: {p.materials || 'Not provided yet'}</Text><Text>{p.description}</Text>{profile.role === 'customer' && <Button title="Reserve (migration pending)" onPress={() => reserve(p)} />}</View>)}</>}
    {tab === 'map' && <><Text style={styles.section}>Find handmade shops</Text><Button title="Use my location" onPress={locate}/><Text>{shops.length} shops with map coordinates</Text><MapView style={{ width: '100%', height: 330, marginTop: 12 }} initialRegion={{ latitude: 27.4728, longitude: 89.6390, latitudeDelta: 1.5, longitudeDelta: 1.5 }} showsUserLocation={!!location}>{shops.map(s => <Marker key={s.id} coordinate={{ latitude: s.latitude, longitude: s.longitude }} title={s.name} description={s.address}/>)}</MapView>{shops.map(s => <Text key={s.id}>📍 {s.name} — {s.address}</Text>)}</>}
    {tab === 'sell' && profile.role === 'shopkeeper' && <><Text style={styles.section}>My shop</Text><Text>Location: {profile.latitude ?? 'Not set'}, {profile.longitude ?? 'Not set'}</Text><Field placeholder="Shop name" value={shopName} onChangeText={setShopName}/><Field placeholder="Address" value={address} onChangeText={setAddress}/><Button title="Get current coordinates" onPress={locate}/><Button title="Save shop location" onPress={saveShopLocation} disabled={!location}/><Text style={styles.section}>Add product</Text><Field placeholder="Product name" value={productName} onChangeText={setProductName}/><Field placeholder="Raw materials / ingredients" value={materials} onChangeText={setMaterials}/><Field placeholder="Description" value={description} onChangeText={setDescription}/><Field placeholder="Price in Nu." value={price} onChangeText={setPrice} keyboardType="numeric"/><Field placeholder="Stock" value={stock} onChangeText={setStock} keyboardType="numeric"/><Field placeholder="Dzongkhag" value={dzongkhag} onChangeText={setDzongkhag}/><Button title="Publish product" onPress={addProduct}/></>}
    {tab === 'bookings' && <><Text style={styles.section}>My reservations</Text>{bookings.length === 0 ? <Text>No bookings found.</Text> : bookings.map(b => <View key={b.id} style={styles.card}><Text>{b.productName || b.product?.name || b.id}</Text><Text>Status: {b.status}</Text></View>)}</>}
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { flexGrow: 1, backgroundColor: '#FFF9F0', padding: 20, gap: 10 }, heading: { fontSize: 29, fontWeight: '800', color: wine }, sub: { color: '#665656', marginBottom: 10 }, section: { fontSize: 21, fontWeight: '700', color: wine, marginTop: 12 }, input: { borderWidth: 1, borderColor: '#D6C9C0', backgroundColor: '#fff', borderRadius: 10, padding: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, button: { backgroundColor: wine, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 9, alignSelf: 'flex-start' }, buttonText: { color: '#fff', fontWeight: '700' }, card: { backgroundColor: '#fff', borderRadius: 14, padding: 15, gap: 7, marginVertical: 4 }, cardTitle: { fontSize: 18, fontWeight: '700' } });
