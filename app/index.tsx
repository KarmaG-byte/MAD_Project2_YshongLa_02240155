import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, getStorage, ref as storageRef, uploadString } from 'firebase/storage';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, type User,
} from 'firebase/auth';
import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  distanceKm, isShopOpen, normalizeBooking, normalizeProduct, normalizeProfile,
  normalizeShop, reserveProduct, saveProduct, setProductActive, transitionBooking,
  type Booking, type Product, type Profile, type Role, type Shop,
} from '../src/marketplace';

const burgundy = '#873239';
const cream = '#FBF8F2';
const ink = '#272322';
const muted = '#746B68';
const line = '#E6DDD8';
type Tab = 'Explore' | 'Nearby' | 'Reservations' | 'Account' | 'My products' | 'Orders' | 'My shop';
type Draft = { name: string; description: string; materials: string; category: string;
  price: string; stock: string; dzongkhag: string; imageUrl: string };
const emptyDraft: Draft = { name: '', description: '', materials: '', category: 'Handmade',
  price: '', stock: '', dzongkhag: '', imageUrl: '' };
type ImageSelection = { uri: string; base64: string; mimeType: string } | null;

function Button({ title, onPress, secondary = false, danger = false, disabled = false }:
  { title: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondaryButton, danger && styles.dangerButton, disabled && { opacity: 0.5 }]}>
    <Text style={[styles.buttonLabel, secondary && styles.secondaryLabel]}>{title}</Text>
  </Pressable>;
}
function Field({ label, value, onChange, placeholder, secure = false, multiline = false, keyboardType }:
  { label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    secure?: boolean; multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' }) {
  return <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder || label}
      placeholderTextColor="#938985" secureTextEntry={secure} multiline={multiline}
      keyboardType={keyboardType || 'default'} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      style={[styles.input, multiline && { minHeight: 86, textAlignVertical: 'top' }]} />
  </View>;
}
function ProductPicture({ url, height = 132 }: { url: string; height?: number }) {
  return url ? <Image source={{ uri: url }} style={{ width: '100%', height, borderRadius: 12, backgroundColor: '#EDE6E1' }}
    resizeMode="cover" /> :
    <View style={[styles.placeholder, { height }]}><Text style={{ fontSize: 33 }}>🧺</Text>
      <Text style={styles.muted}>Made in Bhutan</Text></View>;
}
function Info({ title, detail }: { title: string; detail: string }) {
  return <View style={{ marginBottom: 7 }}><Text style={styles.muted}>{title}</Text><Text style={styles.body}>{detail}</Text></View>;
}
function errorText(e: unknown) { return e instanceof Error ? e.message : String(e); }

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role>('customer');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [initialShopName, setInitialShopName] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<Tab>('Explore');
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState(20);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pickedImage, setPickedImage] = useState<ImageSelection>(null);
  const [shopForm, setShopForm] = useState({ name: '', address: '', dzongkhag: '', phone: '',
    openTime: '09:00', closeTime: '18:00', closedDays: 'Sunday' });

  useEffect(() => onAuthStateChanged(auth, next => {
    setUser(next);
    setProfile(null);
    setReady(true);
  }), []);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setProfile(normalizeProfile(snap.id, snap.data()));
      else setMessage('Account exists but its profile is missing. Please contact the shop administrator or sign out.');
    }, e => setMessage('Profile: ' + e.message));
  }, [user?.uid]);
  useEffect(() => {
    if (!user) { setProducts([]); setShops([]); return; }
    const stopProducts = onSnapshot(collection(db, 'products'),
      snap => setProducts(snap.docs.map(d => normalizeProduct(d.id, d.data()))),
      e => setMessage('Products: ' + e.message));
    const stopShops = onSnapshot(collection(db, 'shops'),
      snap => setShops(snap.docs.map(d => normalizeShop(d.id, d.data()))),
      e => setMessage('Shops: ' + e.message));
    return () => { stopProducts(); stopShops(); };
  }, [user?.uid]);
  useEffect(() => {
    if (!user || !profile) return;
    const field = profile.role === 'customer' ? 'customerId' : 'sellerId';
    return onSnapshot(query(collection(db, 'bookings'), where(field, '==', user.uid)),
      snap => setBookings(snap.docs.map(d => normalizeBooking(d.id, d.data()))),
      e => setMessage('Reservations: ' + e.message));
  }, [user?.uid, profile?.role]);
  useEffect(() => {
    if (profile?.role === 'shopkeeper') {
      setTab(previous => ['My products', 'Orders', 'My shop', 'Nearby'].includes(previous) ? previous : 'My products');
    } else if (profile?.role === 'customer') {
      setTab(previous => ['Explore', 'Nearby', 'Reservations', 'Account'].includes(previous) ? previous : 'Explore');
    }
  }, [profile?.role]);
  const ownShop = shops.find(s => s.id === user?.uid);
  useEffect(() => {
    if (!ownShop) return;
    setShopForm({
      name: ownShop.name, address: ownShop.address, dzongkhag: ownShop.dzongkhag,
      phone: ownShop.phone, openTime: ownShop.openTime, closeTime: ownShop.closeTime,
      closedDays: ownShop.closedDays,
    });
  }, [ownShop?.id, ownShop?.name, ownShop?.address, ownShop?.openTime,
      ownShop?.closeTime, ownShop?.closedDays, ownShop?.dzongkhag, ownShop?.phone]);

  async function authenticate() {
    if (!email.trim() || !password || (register && !fullName.trim())) {
      Alert.alert('Missing details', 'Enter your name (when registering), email and password.'); return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (register) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const uid = cred.user.uid;
        await setDoc(doc(db, 'users', uid), {
          uid, name: fullName.trim(), email: email.trim(), role, createdAt: serverTimestamp(),
        });
        if (role === 'shopkeeper') await setDoc(doc(db, 'shops', uid), {
          name: initialShopName.trim() || fullName.trim() + "'s shop",
          address: '', dzongkhag: '', phone: '', openTime: '09:00',
          closeTime: '18:00', closedDays: 'Sunday', updatedAt: serverTimestamp(),
        });
        setTab(role === 'shopkeeper' ? 'My shop' : 'Explore');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const snap = await getDoc(doc(db, 'users', cred.user.uid));
        if (!snap.exists()) {
          await signOut(auth);
          throw new Error('This account has no Firestore user profile. Existing Project I accounts may require a profile migration.');
        }
        const p = normalizeProfile(cred.user.uid, snap.data());
        if (p.role !== role) {
          await signOut(auth);
          throw new Error('This account is registered as ' + p.role + '. Select the matching role to log in.');
        }
        setTab(role === 'shopkeeper' ? 'My products' : 'Explore');
      }
    } catch (e) { Alert.alert('Authentication', errorText(e)); }
    finally { setBusy(false); }
  }
  async function resetPassword() {
    if (!email.trim()) return Alert.alert('Email needed', 'Enter your email address first.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Email sent', 'Check your inbox for the password reset link.');
    } catch (e) { Alert.alert('Reset password', errorText(e)); }
  }
  async function locate() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return Alert.alert('Permission required', 'Allow location access to find nearby shops.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (e) { Alert.alert('Location', errorText(e)); }
  }
  async function updateShop() {
    if (!user || profile?.role !== 'shopkeeper') return;
    if (!shopForm.name.trim()) return Alert.alert('Shop name required', 'Enter the shop name.');
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(shopForm.openTime) || !time.test(shopForm.closeTime)
      || shopForm.openTime >= shopForm.closeTime) {
      return Alert.alert('Invalid hours', 'Use 24-hour HH:MM times, with closing time after opening time.');
    }
    setBusy(true);
    try {
      await setDoc(doc(db, 'shops', user.uid), {
        ...shopForm, name: shopForm.name.trim(),
        ...(coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Shop saved', 'Shop details and opening hours updated.');
    } catch (e) { Alert.alert('Shop settings', errorText(e)); }
    finally { setBusy(false); }
  }
  function startCreate() {
    setEditId(null); setDraft(emptyDraft); setPickedImage(null); setShowProductForm(true);
  }
  function startEdit(p: Product) {
    setEditId(p.id); setPickedImage(null);
    setDraft({ name: p.name, description: p.description, materials: p.materials, category: p.category,
      price: String(p.price), stock: String(p.stock), dzongkhag: p.dzongkhag, imageUrl: p.imageUrl });
    setShowProductForm(true);
  }
  function updateDraft(key: keyof Draft, value: string) { setDraft(prev => ({ ...prev, [key]: value })); }
  async function chooseImage() {
    try {
      const permissions = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissions.granted) return Alert.alert('Photo permission', 'Allow access to choose a product photo.');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.55, allowsEditing: true, base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const a = result.assets[0];
        if (!a.base64) return Alert.alert('Photo', 'Could not read the selected image. Try another one.');
        setPickedImage({ uri: a.uri, base64: a.base64, mimeType: a.mimeType || 'image/jpeg' });
      }
    } catch (e) { Alert.alert('Photo', errorText(e)); }
  }
  async function submitProduct() {
    if (!user || profile?.role !== 'shopkeeper') return;
    const price = Number(draft.price), stock = Number(draft.stock);
    if (!draft.name.trim() || !draft.materials.trim() || !Number.isFinite(price) || price <= 0 ||
      !Number.isInteger(stock) || stock < 0) {
      return Alert.alert('Product details', 'Enter a name, raw materials, positive price and non-negative whole-number stock.');
    }
    if (draft.imageUrl.trim() && !/^https:\/\//i.test(draft.imageUrl.trim())) {
      return Alert.alert('Product photo', 'Use an HTTPS image URL, or choose a photo to upload.');
    }
    setBusy(true);
    try {
      let imageUrl = draft.imageUrl.trim();
      if (pickedImage) {
        // Image upload requires Firebase Storage to be enabled on the project,
        // with the storage.rules deployed. HTTPS image URLs remain an alternative.
        const path = 'product-images/' + user.uid + '/' + Date.now() + '.jpg';
        const fileRef = storageRef(getStorage(), path);
        await uploadString(fileRef, pickedImage.base64, 'base64', { contentType: pickedImage.mimeType });
        imageUrl = await getDownloadURL(fileRef);
      }
      await saveProduct({
        name: draft.name.trim(), description: draft.description.trim(),
        materials: draft.materials.trim(), category: draft.category.trim() || 'Handmade',
        price, stock, sellerId: user.uid, seller: ownShop?.name || profile.name,
        dzongkhag: draft.dzongkhag.trim(), imageUrl, active: true,
      }, editId || undefined);
      setShowProductForm(false); setPickedImage(null); setEditId(null); setDraft(emptyDraft);
      Alert.alert('Saved', editId ? 'Product updated successfully.' : 'Your product is now listed.');
    } catch (e) {
      Alert.alert('Unable to save product', errorText(e) +
        (pickedImage ? '\n\nIf Firebase Storage is unavailable, remove the selected photo and use a public HTTPS image URL instead.' : ''));
    } finally { setBusy(false); }
  }
  function toggleListing(p: Product) {
    Alert.alert(p.active ? 'Remove listing?' : 'Restore listing?',
      p.active ? 'The product will be hidden from customers; existing reservations are retained.' : 'Show this product again?',
      [{ text: 'Cancel', style: 'cancel' }, { text: p.active ? 'Remove' : 'Restore',
        onPress: async () => {
          try { await setProductActive(p, user?.uid || '', !p.active); }
          catch (e) { Alert.alert('Listing', errorText(e)); }
        } }]);
  }
  function book(p: Product) {
    if (!user || !profile) return;
    Alert.alert('Reserve this product?', 'Reserve 1 × ' + p.name + ' for Nu. ' + p.price.toFixed(2) +
      '. The shopkeeper must confirm it.',
      [{ text: 'Not now', style: 'cancel' }, { text: 'Reserve',
        onPress: async () => {
          setBusy(true);
          try {
            await reserveProduct(p, user.uid, profile.name);
            setTab('Reservations');
            Alert.alert('Requested', 'Your reservation is pending shopkeeper confirmation.');
          } catch (e) { Alert.alert('Reservation', errorText(e)); }
          finally { setBusy(false); }
        } }]);
  }
  function changeStatus(b: Booking, status: 'confirmed' | 'rejected' | 'cancelled' | 'collected') {
    const label = status === 'rejected' || status === 'cancelled' ? 'This releases the reserved stock.' : '';
    Alert.alert('Update reservation', 'Set status to ' + status + '? ' + label,
      [{ text: 'Back', style: 'cancel' }, { text: 'Continue', onPress: async () => {
        setBusy(true);
        try { await transitionBooking(b, user?.uid || '', status); }
        catch (e) { Alert.alert('Reservation', errorText(e)); }
        finally { setBusy(false); }
      } }]);
  }
  const productList = useMemo(() => products.filter(p => {
    if (profile?.role === 'shopkeeper') return p.sellerId === user?.uid;
    return p.active && (p.name + ' ' + p.category + ' ' + p.dzongkhag).toLowerCase().includes(search.toLowerCase());
  }), [products, profile?.role, user?.uid, search]);
  const nearby = useMemo(() => shops
    .filter(s => s.latitude !== undefined && s.longitude !== undefined)
    .map(s => ({ ...s, distance: coordinates
      ? distanceKm(coordinates.latitude, coordinates.longitude, s.latitude!, s.longitude!) : undefined }))
    .filter(s => s.distance === undefined || radius === 0 || s.distance <= radius)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)), [shops, coordinates, radius]);
  const nav: Tab[] = profile?.role === 'shopkeeper'
    ? ['My products', 'Orders', 'My shop', 'Nearby']
    : ['Explore', 'Nearby', 'Reservations', 'Account'];

  if (!ready) return <View style={styles.center}><ActivityIndicator color={burgundy} size="large" /></View>;
  if (!user || !profile) return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}><Text style={styles.eyebrow}>BHUTAN'S LOCAL MARKETPLACE</Text>
        <Text style={styles.logo}>TshongLa 2.0</Text>
        <Text style={styles.muted}>Discover handmade crafts and local artisans.</Text></View>
      {user ? <View style={styles.card}><Text style={styles.title}>Setting up your profile</Text>
        <Text style={styles.body}>{message || 'Reading your account details from Firestore…'}</Text>
        <Button title="Sign out" secondary onPress={() => signOut(auth)} /></View>
        : <View style={styles.card}>
          <Text style={styles.title}>{register ? 'Create an account' : 'Welcome back'}</Text>
          <View style={styles.row}><Button title="Customer" secondary={role !== 'customer'} onPress={() => setRole('customer')} />
            <Button title="Shopkeeper" secondary={role !== 'shopkeeper'} onPress={() => setRole('shopkeeper')} /></View>
          {register && <Field label="Your full name" value={fullName} onChange={setFullName} />}
          {register && role === 'shopkeeper' && <Field label="Shop name" value={initialShopName} onChange={setInitialShopName} />}
          <Field label="Email address" keyboardType="email-address" value={email} onChange={setEmail} />
          <Field label="Password" secure value={password} onChange={setPassword} />
          <Button title={busy ? 'Please wait…' : register ? 'Create account' : 'Log in'} disabled={busy} onPress={authenticate} />
          <Button secondary title={register ? 'Already have an account? Log in' : 'New here? Create account'}
            onPress={() => setRegister(!register)} />
          {!register && <Button secondary title="Forgot password?" onPress={resetPassword} />}
        </View>}
    </ScrollView>
  </SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>HANDMADE IN BHUTAN</Text>
          <Text style={styles.logo}>TshongLa</Text><Text style={styles.muted}>Kuzuzangpo, {profile.name}!</Text></View>
          <Pressable onPress={() => { signOut(auth); setTab('Explore'); }} style={styles.logout}><Text style={styles.muted}>Sign out</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
          {nav.map(n => <Pressable key={n} onPress={() => { setTab(n); setMessage(''); }}
            style={[styles.tab, tab === n && styles.activeTab]}><Text style={[styles.tabText, tab === n && { color: 'white' }]}>{n}</Text></Pressable>)}
        </ScrollView>
        {!!message && <Pressable onPress={() => setMessage('')} style={styles.notice}><Text style={styles.body}>{message}  ×</Text></Pressable>}

        {tab === 'Explore' && profile.role === 'customer' && <>
          <Text style={styles.title}>Explore local treasures</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search products, categories or places"
            placeholderTextColor="#938985" style={styles.input} />
          {productList.length === 0 && <Text style={styles.muted}>No matching products yet.</Text>}
          {productList.map(p => <View key={p.id} style={styles.card}>
            <ProductPicture url={p.imageUrl} height={175} />
            <Text style={styles.title}>{p.name}</Text>
            <Text style={styles.price}>Nu. {p.price.toFixed(2)}</Text>
            <Text style={styles.muted}>{p.category} · {p.dzongkhag || 'Bhutan'} · {p.seller}</Text>
            <Text style={styles.body}>{p.description || 'Handcrafted locally.'}</Text>
            <Info title="Materials / ingredients" detail={p.materials || 'Not listed yet'} />
            <Text style={styles.muted}>Available stock: {p.stock}</Text>
            <Button title={busy ? 'Please wait…' : p.stock > 0 ? 'Reserve for pickup' : 'Out of stock'}
              disabled={busy || p.stock < 1 || !p.sellerId} onPress={() => book(p)} />
            {!p.sellerId && <Text style={styles.muted}>Older listing: shopkeeper must update seller information before booking.</Text>}
          </View>)}
        </>}

        {tab === 'My products' && profile.role === 'shopkeeper' && <>
          <Text style={styles.title}>Manage your products</Text>
          <Text style={styles.muted}>Add, edit, remove or restore your listings.</Text>
          <Button title={showProductForm ? 'Close product form' : '+ Add a product'}
            onPress={() => showProductForm ? setShowProductForm(false) : startCreate()} />
          {showProductForm && <View style={styles.card}>
            <Text style={styles.title}>{editId ? 'Edit product' : 'New product'}</Text>
            <Field label="Product name" value={draft.name} onChange={v => updateDraft('name', v)} />
            <Field label="Raw materials / ingredients" value={draft.materials} onChange={v => updateDraft('materials', v)} multiline />
            <Field label="Description" value={draft.description} onChange={v => updateDraft('description', v)} multiline />
            <Field label="Category" value={draft.category} onChange={v => updateDraft('category', v)} />
            <Field label="Price in Nu." value={draft.price} keyboardType="numeric" onChange={v => updateDraft('price', v)} />
            <Field label="Quantity in stock" value={draft.stock} keyboardType="numeric" onChange={v => updateDraft('stock', v)} />
            <Field label="Dzongkhag" value={draft.dzongkhag} onChange={v => updateDraft('dzongkhag', v)} />
            <Field label="Photo URL (HTTPS; optional)" value={draft.imageUrl} onChange={v => updateDraft('imageUrl', v)} />
            <Button secondary title="Choose a photo from phone" onPress={chooseImage} />
            {(pickedImage?.uri || draft.imageUrl) && <ProductPicture url={pickedImage?.uri || draft.imageUrl} />}
            <Text style={styles.muted}>Phone photo uploads require Firebase Storage. An HTTPS image URL also works.</Text>
            <Button disabled={busy} title={busy ? 'Saving…' : editId ? 'Save changes' : 'Publish product'} onPress={submitProduct} />
            <Button secondary title="Cancel" onPress={() => setShowProductForm(false)} />
          </View>}
          {productList.length === 0 && <Text style={styles.muted}>No products created yet.</Text>}
          {productList.map(p => <View key={p.id} style={styles.card}>
            <ProductPicture url={p.imageUrl} />
            <Text style={styles.title}>{p.name} {p.active ? '' : '(Removed)'}</Text>
            <Text style={styles.price}>Nu. {p.price.toFixed(2)} · {p.stock} in stock</Text>
            <Info title="Materials / ingredients" detail={p.materials || 'Not specified'} />
            <View style={styles.row}><Button title="Edit" onPress={() => startEdit(p)} />
              <Button secondary title={p.active ? 'Remove' : 'Restore'} onPress={() => toggleListing(p)} /></View>
          </View>)}
        </>}

        {tab === 'Nearby' && <>
          <Text style={styles.title}>Find local shops</Text>
          <Text style={styles.muted}>Location is used only while the app is open. Shops must save their location to appear on this map.</Text>
          <Button title="Use my current location" onPress={locate} />
          <View style={styles.row}>{[5, 20, 100, 0].map(km => <Button key={km}
            title={km === 0 ? 'All' : km + ' km'} secondary={radius !== km} onPress={() => setRadius(km)} />)}</View>
          <MapView style={styles.map} key={coordinates ? 'user-map' : 'default-map'}
            initialRegion={{ latitude: coordinates?.latitude ?? 27.4728,
              longitude: coordinates?.longitude ?? 89.6390, latitudeDelta: coordinates ? 0.3 : 2.0,
              longitudeDelta: coordinates ? 0.3 : 2.0 }} showsUserLocation={!!coordinates}>
            {nearby.map(s => <Marker key={s.id}
              coordinate={{ latitude: s.latitude!, longitude: s.longitude! }}
              title={s.name} description={s.address} />)}
          </MapView>
          {!coordinates && <Text style={styles.muted}>Enable location for nearby distance filtering.</Text>}
          {nearby.length === 0 && <Text style={styles.muted}>No shops with saved coordinates found in this area.</Text>}
          {nearby.map(s => <View style={styles.card} key={s.id}>
            <Text style={styles.title}>{s.name}</Text>
            <Text style={styles.muted}>{s.address || s.dzongkhag || 'Address not provided'}</Text>
            {s.distance !== undefined && <Text style={styles.price}>{s.distance.toFixed(1)} km away (straight-line)</Text>}
            <Text style={styles.body}>Hours: {s.openTime}–{s.closeTime} · {isShopOpen(s) ? 'Open by schedule' : 'Closed by schedule'}</Text>
            {!!s.closedDays && <Text style={styles.muted}>Closed: {s.closedDays}</Text>}
            {!!s.phone && <Text style={styles.muted}>Phone: {s.phone}</Text>}
            <Button secondary title="Open in Maps" onPress={() => Linking.openURL(
              'https://www.google.com/maps/search/?api=1&query=' +
              encodeURIComponent(String(s.latitude) + ',' + String(s.longitude)))} />
          </View>)}
        </>}

        {(tab === 'Reservations' || tab === 'Orders') && <>
          <Text style={styles.title}>{profile.role === 'customer' ? 'My reservations' : 'Customer reservations'}</Text>
          {bookings.length === 0 && <Text style={styles.muted}>No reservations yet.</Text>}
          {bookings.map(b => <View key={b.id} style={styles.card}>
            <Text style={styles.title}>{b.productName || 'Product'}</Text>
            <Text style={styles.price}>Nu. {b.unitPrice.toFixed(2)} · Quantity: {b.quantity}</Text>
            <Info title="Status" detail={b.status.toUpperCase()} />
            <Text style={styles.muted}>{profile.role === 'customer' ? 'Seller: ' + b.sellerName : 'Customer: ' + b.customerName}</Text>
            {profile.role === 'customer' && b.status === 'pending' &&
              <Button danger title="Cancel reservation" onPress={() => changeStatus(b, 'cancelled')} />}
            {profile.role === 'shopkeeper' && b.status === 'pending' &&
              <View style={styles.row}><Button title="Confirm" onPress={() => changeStatus(b, 'confirmed')} />
                <Button danger title="Reject" onPress={() => changeStatus(b, 'rejected')} /></View>}
            {profile.role === 'shopkeeper' && b.status === 'confirmed' &&
              <Button title="Mark collected" onPress={() => changeStatus(b, 'collected')} />}
          </View>)}
        </>}

        {tab === 'My shop' && profile.role === 'shopkeeper' && <>
          <Text style={styles.title}>Shop profile and hours</Text>
          <Text style={styles.muted}>Customers see your shop's public details, opening hours and saved map position.</Text>
          <View style={styles.card}>
            <Field label="Shop name" value={shopForm.name} onChange={v => setShopForm(s => ({ ...s, name: v }))} />
            <Field label="Shop address" value={shopForm.address} onChange={v => setShopForm(s => ({ ...s, address: v }))} multiline />
            <Field label="Dzongkhag" value={shopForm.dzongkhag} onChange={v => setShopForm(s => ({ ...s, dzongkhag: v }))} />
            <Field label="Shop phone" value={shopForm.phone} keyboardType="phone-pad"
              onChange={v => setShopForm(s => ({ ...s, phone: v }))} />
            <Field label="Opening time (24-hour HH:MM)" value={shopForm.openTime}
              onChange={v => setShopForm(s => ({ ...s, openTime: v }))} />
            <Field label="Closing time (24-hour HH:MM)" value={shopForm.closeTime}
              onChange={v => setShopForm(s => ({ ...s, closeTime: v }))} />
            <Field label="Days closed (e.g. Sunday, Monday)" value={shopForm.closedDays}
              onChange={v => setShopForm(s => ({ ...s, closedDays: v }))} />
            <Info title="Saved shop coordinates" detail={ownShop?.latitude !== undefined
              ? String(ownShop.latitude) + ', ' + String(ownShop.longitude) : 'Not set yet'} />
            {coordinates && <Text style={styles.muted}>Selected GPS: {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</Text>}
            <Button secondary title="Use my current position for shop" onPress={locate} />
            <Text style={styles.muted}>Choose the position while physically at the shop, then save it as a fixed location.</Text>
            <Button title={busy ? 'Saving…' : 'Save shop information'} disabled={busy} onPress={updateShop} />
          </View>
        </>}

        {tab === 'Account' && <View style={styles.card}>
          <Text style={styles.title}>My account</Text>
          <Info title="Name" detail={profile.name} />
          <Info title="Email" detail={profile.email || user.email || ''} />
          <Info title="Account type" detail={profile.role} />
          <Button secondary title="Send password reset email" onPress={() => {
            if (!user.email) return;
            sendPasswordResetEmail(auth, user.email)
              .then(() => Alert.alert('Email sent', 'Check your inbox.'))
              .catch(e => Alert.alert('Reset password', errorText(e)));
          }} />
          <Button danger title="Sign out" onPress={() => signOut(auth)} />
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cream },
  page: { paddingHorizontal: 18, paddingBottom: 45, paddingTop: 15, gap: 13 },
  brand: { marginTop: 45, marginBottom: 15, gap: 9 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyebrow: { color: burgundy, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  logo: { fontSize: 35, fontWeight: '900', color: burgundy, letterSpacing: -1 },
  title: { fontSize: 19, fontWeight: '800', color: ink, marginBottom: 5 },
  body: { fontSize: 14, color: ink, lineHeight: 21 },
  muted: { fontSize: 13, color: muted, lineHeight: 19 },
  price: { color: burgundy, fontSize: 17, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: line, borderRadius: 17,
    padding: 16, gap: 10, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  fieldGroup: { gap: 5 },
  fieldLabel: { color: ink, fontSize: 13, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFC1BD',
    borderRadius: 10, padding: 13, minHeight: 47, color: ink, fontSize: 14 },
  button: { backgroundColor: burgundy, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 10,
    alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center' },
  buttonLabel: { color: 'white', fontWeight: '800', fontSize: 13 },
  secondaryButton: { backgroundColor: '#F4EBE6', borderWidth: 1, borderColor: '#D9C5BD' },
  secondaryLabel: { color: burgundy },
  dangerButton: { backgroundColor: '#9B443C' },
  tab: { borderWidth: 1, borderColor: line, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, backgroundColor: 'white' },
  activeTab: { backgroundColor: burgundy, borderColor: burgundy },
  tabText: { color: ink, fontWeight: '700', fontSize: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    backgroundColor: '#F1EBE5', gap: 4 },
  notice: { padding: 12, backgroundColor: '#FFF1CF', borderRadius: 10 },
  logout: { padding: 10 },
  map: { width: '100%', height: 300, borderRadius: 15, marginTop: 5 },
});
