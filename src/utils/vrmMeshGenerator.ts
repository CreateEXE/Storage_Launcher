import * as THREE from 'three';
import { AvatarParameters, DEFAULT_AVATAR_PARAMS } from '../types/avatar';

/**
 * Empty group fallback (Procedural mannequin shapes removed)
 */
export function createFemaleKunoichiMesh(_params: AvatarParameters = DEFAULT_AVATAR_PARAMS): THREE.Group {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'VRM_Female_RavenKunoichi';
  return rootGroup;
}

/**
 * Empty group fallback (Procedural mannequin shapes removed)
 */
export function createMaleVesselMesh(_params: AvatarParameters = DEFAULT_AVATAR_PARAMS): THREE.Group {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'VRM_Male_Vessel';
  return rootGroup;
}

