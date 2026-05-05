# Firestore Security Specification - The Luvin

## Data Invariants
1. **Lego Parts**: Metadata like `name`, `type`, and `imageUrl` are immutable for public users. Only `stock` can be adjusted by the public (during checkout). Only Admins can modify all fields including `gender`.
2. **Orders**: Anyone can create an order. Anyone can read an order (if they have the ID). Only Admins can delete orders.
3. **Analytics**: Public can increment counts but cannot delete or read cumulative stats (restricted to Admin).
4. **Shared Designs**: Anyone can create and read. Only Admins can delete.
5. **Collaborators**: Users can only manage their own profile. Admin has full sync visibility.

## The Dirty Dozen (Test Payloads)
| ID | Collection | Action | Payload / Context | Expected |
|----|------------|--------|-------------------|----------|
| 1 | lego_parts | update | { name: "Hacked" } / Guest | DENIED |
| 2 | lego_parts | update | { gender: "female" } / Guest | DENIED |
| 3 | lego_parts | update | { stock: 10 } / Guest | ALLOWED |
| 4 | lego_parts | update | { gender: "male" } / Admin | ALLOWED |
| 5 | orders | delete | { orderId: "123" } / Guest | DENIED |
| 6 | collaborators | update | { uid: "victim" } / Auth(attacker) | DENIED |
| 7 | analytics | delete | { docId: "all" } / Guest | DENIED |
| 8 | config | write | { price: 0 } / Guest | DENIED |
| 9 | backgrounds | create | { id: "bg1" } / Guest | DENIED |
| 10 | lego_parts | update | { stock: "string" } / Guest | DENIED (Type) |
| 11 | lego_parts | update | { price: 999 } / Guest | DENIED (Key) |
| 12 | orders | create | { total: -100 } / Guest | DENIED (Validation) |
