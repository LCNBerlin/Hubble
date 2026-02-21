import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { loadTextureAsync, Renderer, THREE } from "expo-three";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { StorageItem } from "../lib/owned-items";

if (typeof global !== "undefined" && !(global as unknown as { THREE: unknown }).THREE) {
  (global as unknown as { THREE: unknown }).THREE = THREE;
}

const SPHERE_RADIUS = 1.2;
const NODE_RADIUS = 0.06;
const NODE_SEGMENTS = 8;
const CARD_SIZE = 0.14;
const CARD_DEPTH = 0.028;
const ROTATE_SPEED_X = 0.2;
const ROTATE_SPEED_Y = 0.35;
const WEB_TUBE_RADIUS = 0.014;
const WEB_TUBE_SEGMENTS = 6;

/**
 * Place N points evenly on a sphere (Fibonacci-style).
 */
function spherePoints(n: number, radius: number): { x: number; y: number; z: number }[] {
  const points: { x: number; y: number; z: number }[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1 || 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    points.push({
      x: radius * Math.cos(theta) * r,
      y: radius * y,
      z: radius * Math.sin(theta) * r,
    });
  }
  return points;
}

function fallbackColor(kind: StorageItem["kind"]): number {
  if (kind === "purchase") return 0xa78bfa;
  if (kind === "created_product") return 0x22c55e;
  return 0x71717a;
}

type StorageSphereViewProps = {
  items: StorageItem[];
  style?: object;
};

export function StorageSphereView({ items, style }: StorageSphereViewProps) {
  const frameRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

      const renderer = new Renderer({ gl, width, height, pixelRatio: 1 });
      renderer.setClearColor(0x18181b, 1);
      renderer.setSize(width, height);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
      camera.position.z = 3.2;

      const ambient = new THREE.AmbientLight(0x505050, 1.2);
      scene.add(ambient);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(2, 2, 2);
      scene.add(dir);
      const dirBack = new THREE.DirectionalLight(0xffffff, 0.4);
      dirBack.position.set(-2, -2, 2);
      scene.add(dirBack);

      const group = new THREE.Group();

      const sphereGeom = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 1);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x27272a,
        wireframe: false,
        transparent: false,
        opacity: 1,
      });
      const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
      group.add(sphereMesh);

      const positions = spherePoints(Math.max(items.length, 1), SPHERE_RADIUS + CARD_SIZE);
      const n = positions.length;
      const materialsToDispose: THREE.Material[] = [];
      const texturesToDispose: THREE.Texture[] = [];

      // Web: 3D extruded tubes connecting each asset node to several neighbors (on top of sphere)
      const webMat = new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        transparent: false,
        opacity: 1,
      });
      materialsToDispose.push(webMat);
      const webGeoms: THREE.CylinderGeometry[] = [];
      const numNeighbors = Math.min(6, Math.floor(n / 2));
      const up = new THREE.Vector3(0, 1, 0);
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const segmentDir = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        a.set(positions[i].x, positions[i].y, positions[i].z);
        for (let k = 1; k <= numNeighbors; k++) {
          const j = (i + k) % n;
          b.set(positions[j].x, positions[j].y, positions[j].z);
          const length = a.distanceTo(b);
          if (length < 1e-6) continue;
          segmentDir.copy(b).sub(a).normalize();
          const tubeGeom = new THREE.CylinderGeometry(
            WEB_TUBE_RADIUS,
            WEB_TUBE_RADIUS,
            length,
            WEB_TUBE_SEGMENTS
          );
          webGeoms.push(tubeGeom);
          const tube = new THREE.Mesh(tubeGeom, webMat);
          tube.position.lerpVectors(a, b, 0.5);
          tube.quaternion.setFromUnitVectors(up, segmentDir);
          group.add(tube);
        }
      }

      const nodeGeom = new THREE.SphereGeometry(NODE_RADIUS, NODE_SEGMENTS, NODE_SEGMENTS);
      const cardGeom = new THREE.BoxGeometry(CARD_SIZE * 2, CARD_SIZE * 2, CARD_DEPTH);

      const meshByIndex: (THREE.Mesh | null)[] = [];

      items.forEach((item, i) => {
        const pos = positions[i % positions.length];
        const useCard = !!item.previewUri;
        const geom = useCard ? cardGeom : nodeGeom;
        const mat = new THREE.MeshStandardMaterial({
          color: fallbackColor(item.kind),
          side: useCard ? THREE.DoubleSide : THREE.FrontSide,
          transparent: false,
          opacity: 1,
        });
        materialsToDispose.push(mat);
        const nodeMesh = new THREE.Mesh(geom, mat);
        nodeMesh.position.set(pos.x, pos.y, pos.z);
        if (useCard) {
          nodeMesh.lookAt(pos.x * 2, pos.y * 2, pos.z * 2);
        }
        group.add(nodeMesh);
        meshByIndex[i] = nodeMesh;
      });

      items.forEach((item, i) => {
        if (!item.previewUri || !meshByIndex[i]) return;
        const mesh = meshByIndex[i] as THREE.Mesh;
        const oldMat = mesh.material as THREE.MeshStandardMaterial;
        loadTextureAsync({ asset: { uri: item.previewUri } } as { asset: { uri: string } })
          .then((texture: THREE.Texture) => {
            texturesToDispose.push(texture);
            const newMat = new THREE.MeshStandardMaterial({
              map: texture,
              side: THREE.DoubleSide,
              transparent: false,
              opacity: 1,
            });
            materialsToDispose.push(newMat);
            mesh.material = newMat;
            oldMat.dispose();
            if (mesh.geometry instanceof THREE.BoxGeometry) {
              mesh.lookAt(
                mesh.position.x * 2,
                mesh.position.y * 2,
                mesh.position.z * 2
              );
            }
          })
          .catch(() => {});
      });

      scene.add(group);

      let lastTime = 0;
      const animate = (time: number) => {
        const delta = (time - lastTime) / 1000;
        lastTime = time;
        group.rotation.x += delta * ROTATE_SPEED_X;
        group.rotation.y += delta * ROTATE_SPEED_Y;
        renderer.render(scene, camera);
        gl.endFrameEXP();
        frameRef.current = requestAnimationFrame(animate);
      };
      frameRef.current = requestAnimationFrame(animate);

      cleanupRef.current = () => {
        if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
        sphereGeom.dispose();
        sphereMat.dispose();
        webGeoms.forEach((g) => g.dispose());
        nodeGeom.dispose();
        cardGeom.dispose();
        materialsToDispose.forEach((m) => m.dispose());
        texturesToDispose.forEach((t) => t.dispose());
      };
    },
    [items.length]
  );

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <View style={[styles.container, style]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
  },
});
