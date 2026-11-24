/**
 * Prototype inventory. Names, quantities, update times, and map positions are mock data.
 * Replace this catalogue with a pharmacy inventory API when participating pharmacies are connected.
 */
export type DemoPharmacyStock = {
  name: string
  area: string
  distance: string
  stock: number
  updated: string
  initials: string
  color: string
  lat: number
  lng: number
}

export type Medicine = {
  name: string
  detail: string
  form: string
  category: string
  pharmacies: DemoPharmacyStock[]
}

export const demoMedicines: Medicine[] = [
  {
    name: 'Amoxicillin', detail: '500 mg · Capsules', form: 'Capsules', category: 'Antibiotics', pharmacies: [
      { name: 'Kigali Health Pharmacy', area: 'Kacyiru, Kigali', distance: '1.2 km', stock: 25, updated: '12 min ago', initials: 'KH', color: 'mint', lat: -1.9441, lng: 30.0919 },
      { name: 'Remera Community Pharmacy', area: 'Remera, Kigali', distance: '2.8 km', stock: 18, updated: '34 min ago', initials: 'RC', color: 'peach', lat: -1.9574, lng: 30.1112 },
      { name: 'CityCare Pharmacy', area: 'Nyarutarama, Kigali', distance: '3.4 km', stock: 9, updated: '1 hr ago', initials: 'CC', color: 'lavender', lat: -1.9395, lng: 30.1050 },
    ],
  },
  {
    name: 'Paracetamol', detail: '500 mg · Tablets', form: 'Tablets', category: 'Pain relief', pharmacies: [
      { name: 'Kigali Health Pharmacy', area: 'Kacyiru, Kigali', distance: '1.2 km', stock: 42, updated: '8 min ago', initials: 'KH', color: 'mint', lat: -1.9441, lng: 30.0919 },
      { name: 'Remera Community Pharmacy', area: 'Remera, Kigali', distance: '2.8 km', stock: 30, updated: '26 min ago', initials: 'RC', color: 'peach', lat: -1.9574, lng: 30.1112 },
    ],
  },
  {
    name: 'Cetirizine', detail: '10 mg · Tablets', form: 'Tablets', category: 'Allergy', pharmacies: [
      { name: 'CityCare Pharmacy', area: 'Nyarutarama, Kigali', distance: '3.4 km', stock: 16, updated: '18 min ago', initials: 'CC', color: 'lavender', lat: -1.9395, lng: 30.1050 },
      { name: 'Kigali Health Pharmacy', area: 'Kacyiru, Kigali', distance: '1.2 km', stock: 12, updated: '52 min ago', initials: 'KH', color: 'mint', lat: -1.9441, lng: 30.0919 },
    ],
  },
]
