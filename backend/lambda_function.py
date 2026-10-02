import json
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2*math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*'
}

def lambda_handler(event, context):
    if event.get('requestContext', {}).get('http', {}).get('method', '') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body', '{}'))
    except Exception:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    disaster_title = body.get('disasterTitle', 'Unknown')
    category = body.get('category', 'Unknown')
    disaster_lat = float(body.get('disasterLat', 0))
    disaster_lon = float(body.get('disasterLon', 0))
    sat_name = body.get('satName', 'Unknown')
    sat_lat = float(body.get('satLat', 0))
    sat_lon = float(body.get('satLon', 0))
    sat_alt = float(body.get('satAlt', 0))

    ground_distance_km = round(haversine(disaster_lat, disaster_lon, sat_lat, sat_lon), 2)
    estimated_intercept_min = round(ground_distance_km / (7.5 * 60), 2)

    if ground_distance_km < 500:
        imaging_lock_status = 'LOCKED'
    elif ground_distance_km < 1500:
        imaging_lock_status = 'ACQUIRING'
    else:
        imaging_lock_status = 'OUT_OF_RANGE'

    sensor_map = {
        'Wildfires': 'SWIR+Thermal',
        'Volcanoes': 'Multispectral+TIR',
        'Severe Storms': 'SAR+Optical',
        'Floods': 'SAR+Multispectral'
    }
    recommended_sensor_mode = sensor_map.get(category, 'Optical+NIR')

    priority_score = min(99, max(55, int(99 - (ground_distance_km / 50))))

    action_brief_map = {
        'LOCKED': [
            f'Initiate high-resolution imaging pass over {disaster_title}',
            f'Deploy {recommended_sensor_mode} sensor array at full gain',
            'Transmit imagery to ground station within current overpass window'
        ],
        'ACQUIRING': [
            f'Slew {sat_name} to acquire lock on {disaster_title} zone',
            f'Pre-configure {recommended_sensor_mode} sensors for imminent capture',
            'Alert ground team: imaging window opens in ~' + str(estimated_intercept_min) + ' min'
        ],
        'OUT_OF_RANGE': [
            f'Track {disaster_title}: target is outside current imaging range',
            f'Schedule {sat_name} retasking for next orbital pass',
            f'Estimated time to intercept range: {estimated_intercept_min} min — standby'
        ]
    }
    action_brief = action_brief_map.get(imaging_lock_status, action_brief_map['OUT_OF_RANGE'])

    result = {
        'groundDistanceKm': ground_distance_km,
        'estimatedInterceptMin': estimated_intercept_min,
        'imagingLockStatus': imaging_lock_status,
        'recommendedSensorMode': recommended_sensor_mode,
        'priorityScore': priority_score,
        'actionBrief': action_brief
    }

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(result)
    }
