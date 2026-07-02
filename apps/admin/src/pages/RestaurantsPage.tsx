import { LocationScopedModuleShell } from '../components/location-scoped/LocationScopedModuleShell';
import { EmptyState } from '../components/ui/EmptyState';

export function RestaurantsPage() {
  return (
    <LocationScopedModuleShell title="Restoranlar">
      <EmptyState
        title="Yakında"
        description="Restoran modülü henüz kullanılamıyor. Lokasyon seçimi ve diğer lokasyon modülleriyle aynı iş akışı burada da geçerli olacak."
      />
    </LocationScopedModuleShell>
  );
}
