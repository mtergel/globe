import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { InstancedMesh } from "three";
import { CubicBezierLine, OrbitControls } from "@react-three/drei";
import { geoInterpolate } from "d3";

// consts
const DOT_COUNT = 60000;
const IMAGE_HEIGHT = 200;
const IMAGE_WIDTH = 400;
const GLOBE_RADIUS = 600;
const GLOBE_SQUARED = GLOBE_RADIUS * GLOBE_RADIUS;
const vector = new THREE.Vector3();
const temp = new THREE.Object3D();
const center = new THREE.Vector3(0, 0, 0);

type Coordinate = {
  lat: number;
  lon: number;
};
type PRType = {
  uml: string;
  gm: Coordinate;
  uol: string;
  gop: Coordinate;
  l: string;
  nwo: string;
  pr: number;
  ma: string;
  oa: string;
};

const testData = [
  {
    uml: "Brisbane",
    gm: { lat: -27.469, lon: 153.0235 },
    uol: "Austin",
    gop: { lat: 30.2711, lon: -97.7437 },
    l: "Java",
    nwo: "ConsenSys/teku",
    pr: 5283,
    ma: "2022-04-03T22:01:22Z",
    oa: "2022-04-03T00:32:51Z",
  },
] as PRType[];

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

        vector.setFromSphericalCoords(GLOBE_RADIUS, phi, theta);

        // Create position
        const posSphere = new THREE.Vector3();
        posSphere.copy(vector);

        const n = new THREE.Vector3();
        n.copy(vector);
        n.normalize();

        // Check position
        const uv = {
          u: Math.atan2(n.x, n.z) / (2 * Math.PI) + 0.5,
          v: Math.asin(n.y) / Math.PI + 0.5,
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
          position: [0, 0, -GLOBE_RADIUS * 3.5],
          far: 3600,
        }}
      >
        <OrbitControls />
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS]} />
          <meshBasicMaterial color="#0a2645" opacity={0.5} />
        </mesh>
        {positions && <Dots positions={positions} />}
        {positions && <Arc data={testData} />}
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
    if (ref.current) {
      for (let i = 0; i < positions.length; i++) {
        let position = positions[i];

        // set rotation, position
        temp.position.set(position.x, -position.y, position.z);
        temp.lookAt(0, 0, 0);

        // calc matrix
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
      <circleBufferGeometry args={[2, 5]} />
      <meshBasicMaterial color="#104b7f" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function toXYZ(lat: number, lon: number, radius: number) {
  const spherical = new THREE.Spherical(
    radius,
    THREE.MathUtils.degToRad(90 - lat),
    THREE.MathUtils.degToRad(lon)
  );
  const vector = new THREE.Vector3();

  vector.setFromSpherical(spherical);
  return vector;
}

interface ArcsProps {
  data: PRType[];
}

function Arc({ data }: ArcsProps) {
  const d = data[0];
  const arcRef = useRef<any>(null);
  const startXYZ = toXYZ(d.gm.lat, d.gm.lon, GLOBE_RADIUS);
  const endXYZ = toXYZ(d.gop.lat, d.gop.lon, GLOBE_RADIUS);

  const d3Interpolate = geoInterpolate(
    [d.gm.lon, d.gm.lat],
    [d.gop.lon, d.gop.lat]
  );

  const control1 = d3Interpolate(0.25);
  const control2 = d3Interpolate(0.75);

  // arc height to half the distance between points
  const distanceBetween =
    GLOBE_RADIUS * Math.acos(startXYZ.dot(endXYZ) / GLOBE_SQUARED);
  const arcHeight = distanceBetween * 0.5 + GLOBE_RADIUS;
  const controlXYZ1 = toXYZ(control1[1], control1[0], arcHeight);
  const controlXYZ2 = toXYZ(control2[1], control2[0], arcHeight);

  const arcMinTime = 1;
  const arcMaxTime = 5;

  const randomTime = useMemo(() => {
    return (
      (Math.floor(Math.random() * (arcMaxTime - arcMinTime + 1)) + arcMinTime) /
      1000
    );
  }, []);

  useFrame(() => {
    arcRef.current.material.uniforms.dashOffset.value -= randomTime;
  });

  return (
    <>
      <Pole xyz={startXYZ} />
      <Pole xyz={endXYZ} />
      <CubicBezierLine
        start={startXYZ}
        end={endXYZ}
        midA={controlXYZ1}
        midB={controlXYZ2}
        color="#ffffff"
        segments={44}
        dashed
        dashScale={0.00024}
        ref={arcRef}
      />
    </>
  );
}

interface PoleProps {
  xyz: THREE.Vector3;
}

function Pole({ xyz }: PoleProps) {
  const groupRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(center);
    }
  }, []);

  return (
    <group ref={groupRef} position={xyz}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 100, 5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export default App;
