# ⛩️ BOT GAKURAN

## 📦 Installation

1. Vide ton ancien dossier `bot-lspd` ou crée un nouveau dossier
2. Mets ton logo Gakuran renommé en `logo.png` à la racine (à côté de `index.js`)
3. Ouvre un terminal dans le dossier et tape :

```
npm install
```

4. Déploie les commandes :
```
node deploy-commands.js
```

5. Lance le bot :
```
node index.js
```

---

## 🎮 Commandes

### 📋 Activity Check
| Commande | Description |
|---|---|
| `/activitycheck lancer objectif:50` | Lance un check avec objectif personnalisé |
| `/activitycheck terminer` | Termine manuellement le check en cours |

### 🎯 KOS (Kill On Sight)
| Commande | Description |
|---|---|
| `/kos ajouter nom:X raison:X` | Ajoute une cible (met à jour le message auto) |
| `/kos retirer nom:X` | Retire une cible (met à jour le message auto) |

### 🤝 Relations
| Commande | Description |
|---|---|
| `/relations ajouter nom:X type:allié` | Ajoute/modifie une relation |
| `/relations retirer nom:X` | Retire une relation |
Types : `allié` / `neutre` / `ennemi` / `guerre`

### 🌳 Arbre organisationnel
| Commande | Description |
|---|---|
| `/arbre chef @membre titre:Oyabun` | Définit le chef du gang |
| `/arbre division creer nom:X emoji:⚔️ couleur:#FF4444` | Crée une division |
| `/arbre division supprimer nom:X` | Supprime une division |
| `/arbre ajouter @membre role:X division:X` | Ajoute un membre à l'arbre |
| `/arbre retirer @membre` | Retire un membre de l'arbre |
| `/arbre afficher` | Génère et envoie l'image de l'arbre |

---

## ⚠️ Important
- Toutes les commandes sont réservées au rôle **Chief** (sauf `/arbre afficher`)
- KOS et Relations mettent à jour automatiquement le même message (pas de doublon)
- Le logo `logo.png` doit être présent à la racine sinon le bot plante
- Après avoir modifié les commandes → relancer `node deploy-commands.js`
