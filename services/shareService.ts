
import { db } from '../config/firebase';
import { collection, addDoc, getDoc, doc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { FrameConfig, SavedDesign, Collaborator } from '../types';

export const saveSharedDesign = async (config: FrameConfig, createdBy: string) => {
    try {
        const docRef = await addDoc(collection(db, 'shared_designs'), {
            config,
            createdBy,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving shared design:", error);
        return null;
    }
};

export const getSharedDesign = async (designId: string) => {
    try {
        const docSnap = await getDoc(doc(db, 'shared_designs', designId));
        if (docSnap.exists()) {
            return docSnap.data().config as FrameConfig;
        }
        return null;
    } catch (error) {
        console.error("Error getting shared design:", error);
        return null;
    }
};

export const saveCTVDesign = async (ctvUid: string, name: string, config: FrameConfig) => {
    try {
        const designId = Math.random().toString(36).substring(2, 15);
        const newDesign: SavedDesign = {
            id: designId,
            ctvUid,
            name,
            config,
            createdAt: Date.now()
        };
        
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'collaborators', ctvUid), {
            designs: arrayUnion(newDesign)
        }, { merge: true });
        
        return designId;
    } catch (error) {
        console.error("Error saving CTV design (primary):", error);
        // Fallback to ctv_designs if collaborators update fails
        try {
            const docRef = await addDoc(collection(db, 'ctv_designs'), {
                ctvUid,
                name,
                config,
                createdAt: Date.now()
            });
            return docRef.id;
        } catch (e2) {
            console.warn("Fallback saveCTVDesign failed:", e2);
            return null;
        }
    }
};

export const getCTVDesigns = async (ctvUid: string): Promise<SavedDesign[]> => {
    try {
        console.log("Fetching designs for CTV:", ctvUid);
        const docSnap = await getDoc(doc(db, 'collaborators', ctvUid));
        if (docSnap.exists()) {
            const data = docSnap.data() as Collaborator;
            if (data.designs) {
                return data.designs.sort((a, b) => b.createdAt - a.createdAt);
            }
        }
        
        // Fallback to ctv_designs collection - wrap in try-catch to avoid surfacing permission errors
        // if the collection rules aren't deployed
        try {
            const { query, where, getDocs } = await import('firebase/firestore');
            // Remove orderBy to avoid index requirement in fallback
            const q = query(
                collection(db, 'ctv_designs'),
                where('ctvUid', '==', ctvUid)
            );
            const querySnapshot = await getDocs(q);
            const designs: SavedDesign[] = [];
            querySnapshot.forEach((doc) => {
                designs.push({ id: doc.id, ...doc.data() } as SavedDesign);
            });
            // Sort in memory
            return designs.sort((a, b) => b.createdAt - a.createdAt);
        } catch (fallbackError) {
            console.warn("Fallback getCTVDesigns failed (likely permissions or missing collection):", fallbackError);
            return [];
        }
    } catch (error) {
        console.error("Error getting CTV designs (primary):", error);
        return [];
    }
};

export const deleteCTVDesign = async (designId: string, ctvUid?: string) => {
    try {
        if (ctvUid) {
            const docRef = doc(db, 'collaborators', ctvUid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Collaborator;
                if (data.designs) {
                    const updatedDesigns = data.designs.filter(d => d.id !== designId);
                    await updateDoc(docRef, { designs: updatedDesigns });
                    return true;
                }
            }
        }
        
        // Fallback/Legacy delete - wrap in try-catch
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'ctv_designs', designId));
            return true;
        } catch (fallbackError) {
            console.warn("Fallback deleteCTVDesign failed:", fallbackError);
            return false;
        }
    } catch (error) {
        console.error("Error deleting CTV design:", error);
        return false;
    }
};
