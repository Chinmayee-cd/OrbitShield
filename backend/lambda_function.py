import json
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def lambda_handler(event, context):
    http_method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', 'GET'))

    # Handle OPTIONS preflight — no manual CORS headers; Function URL config handles them
    if http_method == 'OPTIONS':
        return {'statusCode': 200, 'body': ''}

    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            params = json.loads(body)
        else:
            params = body

        disaster_lat = float(params.get('disasterLat', 0))
        disaster_lon = float(params.get('disasterLon', 0))
        sat_lat = float(params.get('satLat', 0))
        sat_lon = float(params.get('satLon', 0))
        sat_alt = float(params.get('satAlt', 500))
        category = params.get('category', 'Unknown')
        sat_name = params.get('satName', 'Unknown')
        disaster_title = params.get('disasterTitle', 'Unknown')

        ground_dist = haversine(disaster_lat, disaster_lon, sat_lat, sat_lon)
        intercept_min = ground_dist / (7.5 * 60)

        if ground_dist < 500:
            imaging_lock = 'LOCKED'
        elif ground_dist < 1500:
            imaging_lock = 'ACQUIRING'
        else:
            imaging_lock = 'OUT_OF_RANGE'

        sensor_map = {
            'Wildfires': 'SWIR+Thermal',
            'Volcanoes': 'Multispectral+TIR',
            'Severe Storms': 'SAR+Optical',
            'Floods': 'SAR+Multispectral'
        }
        sensor_mode = sensor_map.get(category, 'Optical+NIR')

        priority = min(99, max(55, round(99 - (ground_dist / 50))))

        action_brief = [
            f'Deploy {sensor_mode} sensor suite for {category} monitoring',
            f'Initiate overpass sequence — ETA {intercept_min:.1f} min at current orbital velocity',
            'Begin high-resolution capture sequence' if imaging_lock == 'LOCKED'
            else 'Adjust attitude for optimal imaging geometry' if imaging_lock == 'ACQUIRING'
            else 'Relay tasking to next available overpass window'
        ]

        result = {
            'groundDistanceKm': round(ground_dist, 2),
            'estimatedInterceptMin': round(intercept_min, 2),
            'imagingLockStatus': imaging_lock,
            'recommendedSensorMode': sensor_mode,
            'priorityScore': priority,
            'actionBrief': action_brief
        }

        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
