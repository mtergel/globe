import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { InstancedMesh } from "three";
import { OrbitControls } from "@react-three/drei";

// consts
const DOT_COUNT = 60000;
const IMAGE_HEIGHT = 200;
const IMAGE_WIDTH = 400;
const vector = new THREE.Vector3();
const temp = new THREE.Object3D();

function App() {
  const [mapData, setMapData] = useState<CanvasRenderingContext2D | null>(null);
  const worldCanvas = useRef<HTMLCanvasElement>(null);
  const [positions, setPositions] = useState<THREE.Vector3[] | null>(null);

  useEffect(() => {
    if (worldCanvas && worldCanvas.current) {
      const context = worldCanvas.current.getContext("2d")!;
      const image = new Image();
      image.src = "map.png";
      image.onload = () => {
        // Set map data
        context.drawImage(image, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        setMapData(context);
      };
    }
  }, []);

  useEffect(() => {
    if (mapData) {
      const pos = [] as THREE.Vector3[];
      for (let i = DOT_COUNT; i >= 0; i--) {
        const phi = Math.acos(-1 + (2 * i) / DOT_COUNT);
        const theta = Math.sqrt(DOT_COUNT * Math.PI) * phi;

        vector.setFromSphericalCoords(600, phi, theta);

        // Create position
        const posSphere = new THREE.Vector3();
        posSphere.copy(vector);

        const n = new THREE.Vector3();
        n.copy(vector);
        n.normalize();

        // console.log(n);
        // Check position
        const uv = {
          u: Math.atan2(n.x, n.z) / (2 * Math.PI) + 0.5,
          v: n.y * 0.5 + 0.5,
        };

        const x = uv.u * IMAGE_WIDTH;
        const y = uv.v * IMAGE_HEIGHT;
        const pixelData = mapData.getImageData(x, y, 1, 1);

        if (pixelData.data[3] >= 90) {
          pos.push(posSphere);
        }
      }

      setPositions(pos);
    }
  }, [mapData]);

  return (
    <div id="canvas-container">
      <canvas
        id="world"
        height={IMAGE_HEIGHT}
        width={IMAGE_WIDTH}
        ref={worldCanvas}
        className="hidden"
      />
      <Canvas
        camera={{
          position: [0, 0, -600 * 3.5],
          far: 3600,
        }}
      >
        <OrbitControls />
        {positions && <Dots positions={positions} />}
      </Canvas>
    </div>
  );
}

interface DotsProps {
  positions: THREE.Vector3[];
}
function Dots({ positions }: DotsProps) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    if (ref && ref.current) {
      for (let i = 0; i < positions.length; i++) {
        let position = positions[i];
        temp.lookAt(position);

        temp.position.set(position.x, -position.y, position.z);
        temp.updateMatrix();

        // create id for instances
        const id = i++;
        ref.current.setMatrixAt(id, temp.matrix);

        // Update instance
        ref.current.instanceMatrix.needsUpdate = true;
      }
    }
    // eslint-disable-next-line
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
      <sphereBufferGeometry args={[4, 3, 2]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

export default App;
